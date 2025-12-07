import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TradingAccount } from '@/lib/api'
import PacmanLoader from '@/components/ui/pacman-loader'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  promptResult?: string | null
}

interface Conversation {
  id: number
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface AiPromptChatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: TradingAccount[]
  accountsLoading: boolean
  onApplyPrompt: (promptText: string) => void
}

export default function AiPromptChatModal({
  open,
  onOpenChange,
  accounts,
  accountsLoading,
  onApplyPrompt,
}: AiPromptChatModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractedPrompts, setExtractedPrompts] = useState<Array<{id: number, content: string}>>([])
  const [selectedPromptIndex, setSelectedPromptIndex] = useState<number>(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Load conversations when modal opens
  useEffect(() => {
    if (open) {
      loadConversations()
      // Select first AI account by default
      const aiAccounts = accounts.filter(acc => acc.account_type === 'AI')
      if (aiAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(aiAccounts[0].id)
      }
    }
  }, [open, accounts])

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId)
    }
  }, [currentConversationId])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const response = await fetch('/api/prompts/ai-conversations')
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      } else if (response.status === 403) {
        toast.error('This feature is only available for premium members')
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await fetch(`/api/prompts/ai-conversations/${conversationId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])

        // Extract ALL prompts from assistant messages (for version management)
        const prompts: Array<{id: number, content: string}> = []
        data.messages
          .filter((m: Message) => m.role === 'assistant' && m.promptResult)
          .forEach((m: Message) => {
            if (m.promptResult) {
              prompts.push({
                id: m.id,
                content: m.promptResult
              })
            }
          })
        setExtractedPrompts(prompts)
        // Select the latest version by default
        if (prompts.length > 0) {
          setSelectedPromptIndex(prompts.length - 1)
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || !selectedAccountId) {
      return
    }

    if (!selectedAccountId) {
      toast.error('Please select an AI Trader first')
      return
    }

    const userMessage = userInput.trim()
    setUserInput('')
    setLoading(true)

    // Optimistically add user message to UI
    const tempUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const response = await fetch('/api/prompts/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          userMessage: userMessage,
          conversationId: currentConversationId,
        }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('This feature is only available for premium members')
          onOpenChange(false)
          return
        }
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      if (data.success) {
        // Update conversation ID if this was a new conversation
        if (!currentConversationId && data.conversationId) {
          setCurrentConversationId(data.conversationId)
          loadConversations() // Refresh conversation list
        }

        // Add assistant message
        const assistantMsg: Message = {
          id: data.messageId,
          role: 'assistant',
          content: data.content,
          promptResult: data.promptResult,
        }
        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg])

        // Add new prompt to version list if available
        if (data.promptResult) {
          setExtractedPrompts(prev => {
            const newPrompts = [...prev, {
              id: data.messageId,
              content: data.promptResult
            }]
            // Select the newly added prompt (latest version) - use the new array length
            setSelectedPromptIndex(newPrompts.length - 1)
            return newPrompts
          })
        }
      } else {
        toast.error(data.error || 'Failed to generate response')
        // Remove optimistic user message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setLoading(false)
    }
  }


  const handleApplyPrompt = (index?: number) => {
    const idx = index !== undefined ? index : selectedPromptIndex
    const prompt = extractedPrompts[idx]
    if (prompt) {
      onApplyPrompt(prompt.content)
      toast.success('Prompt applied to editor')
      onOpenChange(false)
    }
  }

  const startNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    setExtractedPrompts([])
    setSelectedPromptIndex(0)
  }

  const aiAccounts = accounts.filter(acc => acc.account_type === 'AI')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-[1600px] h-[85vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>AI Strategy Prompt Generator</DialogTitle>
            {(accountsLoading || loadingConversations) && (
              <PacmanLoader className="w-8 h-4" />
            )}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">AI Trader</label>
              <Select
                value={selectedAccountId?.toString()}
                onValueChange={(val) => setSelectedAccountId(parseInt(val))}
                disabled={accountsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={accountsLoading ? "Loading..." : "Select AI Trader"} />
                </SelectTrigger>
                <SelectContent>
                  {aiAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.name} ({acc.model})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Conversation</label>
              <div className="flex gap-2">
                <Select
                  value={currentConversationId?.toString() || 'new'}
                  onValueChange={(val) => {
                    if (val === 'new') {
                      startNewConversation()
                    } else {
                      setCurrentConversationId(parseInt(val))
                    }
                  }}
                  disabled={loadingConversations}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingConversations ? "Loading..." : "New Conversation"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Conversation</SelectItem>
                    {conversations.map(conv => (
                      <SelectItem key={conv.id} value={conv.id.toString()}>
                        {conv.title} ({conv.messageCount} msgs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startNewConversation}
                  className="shrink-0"
                >
                  New
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Chat Area (40%) */}
          <div className="w-[40%] flex flex-col border-r">
            <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">Start by describing your trading strategy</p>
                    <p className="text-xs mt-2">Example: "I want a trend-following strategy using MA crossovers"</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-1 opacity-70">
                        {msg.role === 'user' ? 'You' : 'AI Assistant'}
                      </div>
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            code: ({ node, inline, className, children, ...props }) => {
                              // Don't render ```prompt blocks in chat (they go to artifact panel)
                              const match = /language-(\w+)/.exec(className || '')
                              if (!inline && match?.[1] === 'prompt') {
                                return null
                              }
                              return inline ? (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2 items-end">
                <textarea
                  placeholder="Describe your strategy or ask for modifications..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={loading || !selectedAccountId}
                  className="flex-1 min-h-[80px] max-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  rows={3}
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !userInput.trim() || !selectedAccountId}
                  className="h-[80px]"
                >
                  {loading ? 'Sending...' : 'Send'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>

          {/* Right: Artifact Preview (60%) */}
          <div className="w-[60%] flex flex-col bg-muted/30">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Generated Prompts</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {extractedPrompts.length > 0
                      ? `${extractedPrompts.length} version${extractedPrompts.length > 1 ? 's' : ''} available`
                      : 'The AI-generated strategy prompt will appear here'}
                  </p>
                </div>
                {extractedPrompts.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPromptIndex(Math.max(0, selectedPromptIndex - 1))}
                      disabled={selectedPromptIndex === 0}
                      className="h-7 px-2"
                    >
                      ← Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {selectedPromptIndex + 1} / {extractedPrompts.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPromptIndex(Math.min(extractedPrompts.length - 1, selectedPromptIndex + 1))}
                      disabled={selectedPromptIndex === extractedPrompts.length - 1}
                      className="h-7 px-2"
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {extractedPrompts.length > 0 ? (
                <div className="space-y-4">
                  {extractedPrompts.length > 1 && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      Version {selectedPromptIndex + 1} of {extractedPrompts.length}
                      {selectedPromptIndex === extractedPrompts.length - 1 && ' (Latest)'}
                    </div>
                  )}
                  <div className="rounded-lg overflow-hidden border">
                    <SyntaxHighlighter
                      language="markdown"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                      }}
                    >
                      {extractedPrompts[selectedPromptIndex]?.content || ''}
                    </SyntaxHighlighter>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <p className="text-sm">No prompt generated yet</p>
                    <p className="text-xs mt-2">
                      Start a conversation to generate a strategy prompt
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>

            {extractedPrompts.length > 0 && (
              <div className="p-4 border-t flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const currentPrompt = extractedPrompts[selectedPromptIndex]
                    if (currentPrompt) {
                      navigator.clipboard.writeText(currentPrompt.content)
                      toast.success('Prompt copied to clipboard')
                    }
                  }}
                >
                  Copy
                </Button>
                <Button onClick={() => handleApplyPrompt()}>
                  Apply to Editor
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
