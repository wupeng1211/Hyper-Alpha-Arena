import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  getPromptTemplates,
  updatePromptTemplate,
  upsertPromptBinding,
  deletePromptBinding,
  getAccounts,
  createPromptTemplate,
  copyPromptTemplate,
  deletePromptTemplate,
  updatePromptTemplateName,
  PromptTemplate,
  PromptBinding,
  TradingAccount,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PromptPreviewDialog from './PromptPreviewDialog'

interface BindingFormState {
  id?: number
  accountId?: number
  promptTemplateId?: number
}

const DEFAULT_BINDING_FORM: BindingFormState = {
  accountId: undefined,
  promptTemplateId: undefined,
}

export default function PromptManager() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [bindings, setBindings] = useState<PromptBinding[]>([])
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [templateDraft, setTemplateDraft] = useState<string>('')
  const [nameDraft, setNameDraft] = useState<string>('')
  const [descriptionDraft, setDescriptionDraft] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bindingSaving, setBindingSaving] = useState(false)
  const [bindingForm, setBindingForm] = useState<BindingFormState>(DEFAULT_BINDING_FORM)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

  // New template dialog
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [creating, setCreating] = useState(false)

  // Copy template dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyName, setCopyName] = useState('')
  const [copying, setCopying] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedId) || null,
    [templates, selectedId],
  )

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await getPromptTemplates()
      setTemplates(data.templates)
      setBindings(data.bindings)

      if (!selectedId && data.templates.length > 0) {
        const first = data.templates[0]
        setSelectedId(first.id)
        setTemplateDraft(first.templateText)
        setNameDraft(first.name)
        setDescriptionDraft(first.description ?? '')
      } else if (selectedId) {
        const tpl = data.templates.find((item) => item.id === selectedId)
        if (tpl) {
          setTemplateDraft(tpl.templateText)
          setNameDraft(tpl.name)
          setDescriptionDraft(tpl.description ?? '')
        }
      }
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load prompt templates')
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try {
      const list = await getAccounts()
      setAccounts(list)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load AI traders')
    } finally {
      setAccountsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectTemplate = (id: string) => {
    const numId = Number(id)
    setSelectedId(numId)
    const tpl = templates.find((item) => item.id === numId)
    setTemplateDraft(tpl?.templateText ?? '')
    setNameDraft(tpl?.name ?? '')
    setDescriptionDraft(tpl?.description ?? '')
  }

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return
    setSaving(true)
    try {
      const updated = await updatePromptTemplate(selectedTemplate.key, {
        templateText: templateDraft,
        description: descriptionDraft,
        updatedBy: 'ui',
      })

      // Also update name if changed
      if (nameDraft !== selectedTemplate.name) {
        await updatePromptTemplateName(selectedTemplate.id, {
          name: nameDraft,
          description: descriptionDraft,
          updatedBy: 'ui',
        })
      }

      setTemplates((prev) =>
        prev.map((tpl) =>
          tpl.id === selectedTemplate.id
            ? { ...tpl, ...updated, name: nameDraft, description: descriptionDraft }
            : tpl,
        ),
      )
      toast.success('Prompt template saved')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to save prompt template')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    setCreating(true)
    try {
      const created = await createPromptTemplate({
        name: newTemplateName,
        description: newTemplateDescription,
        createdBy: 'ui',
      })

      setTemplates((prev) => [created, ...prev])
      setSelectedId(created.id)
      setTemplateDraft(created.templateText)
      setNameDraft(created.name)
      setDescriptionDraft(created.description ?? '')

      setNewTemplateDialogOpen(false)
      setNewTemplateName('')
      setNewTemplateDescription('')
      toast.success('Template created')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setCreating(false)
    }
  }

  const handleCopyTemplate = async () => {
    if (!selectedTemplate) return

    setCopying(true)
    try {
      const copied = await copyPromptTemplate(selectedTemplate.id, {
        newName: copyName || undefined,
        createdBy: 'ui',
      })

      setTemplates((prev) => [copied, ...prev])
      setSelectedId(copied.id)
      setTemplateDraft(copied.templateText)
      setNameDraft(copied.name)
      setDescriptionDraft(copied.description ?? '')

      setCopyDialogOpen(false)
      setCopyName('')
      toast.success('Template copied')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to copy template')
    } finally {
      setCopying(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    if (selectedTemplate.isSystem === 'true') {
      toast.error('Cannot delete system templates')
      return
    }

    if (!confirm(`Delete template "${selectedTemplate.name}"?`)) {
      return
    }

    try {
      await deletePromptTemplate(selectedTemplate.id)
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== selectedTemplate.id))

      // Select first available template
      const remaining = templates.filter((tpl) => tpl.id !== selectedTemplate.id)
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id)
        setTemplateDraft(remaining[0].templateText)
        setNameDraft(remaining[0].name)
        setDescriptionDraft(remaining[0].description ?? '')
      } else {
        setSelectedId(null)
        setTemplateDraft('')
        setNameDraft('')
        setDescriptionDraft('')
      }

      toast.success('Template deleted')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  const handleBindingSubmit = async () => {
    if (!bindingForm.accountId) {
      toast.error('Please select an AI trader')
      return
    }
    if (!bindingForm.promptTemplateId) {
      toast.error('Please select a prompt template')
      return
    }

    setBindingSaving(true)
    try {
      const payload = await upsertPromptBinding({
        id: bindingForm.id,
        accountId: bindingForm.accountId,
        promptTemplateId: bindingForm.promptTemplateId,
        updatedBy: 'ui',
      })

      setBindings((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === payload.id)
        if (existingIndex !== -1) {
          const next = [...prev]
          next[existingIndex] = payload
          return next
        }
        return [...prev, payload].sort((a, b) => a.accountName.localeCompare(b.accountName))
      })
      setBindingForm(DEFAULT_BINDING_FORM)
      toast.success('Prompt binding saved')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to save binding')
    } finally {
      setBindingSaving(false)
    }
  }

  const handleDeleteBinding = async (bindingId: number) => {
    try {
      await deletePromptBinding(bindingId)
      setBindings((prev) => prev.filter((item) => item.id !== bindingId))
      toast.success('Binding deleted')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete binding')
    }
  }

  const handleEditBinding = (binding: PromptBinding) => {
    setBindingForm({
      id: binding.id,
      accountId: binding.accountId,
      promptTemplateId: binding.promptTemplateId,
    })
  }

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDraft(selectedTemplate.templateText)
      setNameDraft(selectedTemplate.name)
      setDescriptionDraft(selectedTemplate.description ?? '')
    }
  }, [selectedTemplate])

  const accountOptions = useMemo(() => {
    return accounts
      .filter((account) => account.account_type === 'AI')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [accounts])

  return (
    <>
      <div className="h-full w-full overflow-hidden flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
        {/* LEFT COLUMN - Template Selection + Edit Area */}
        <div className="flex-1 flex flex-col h-full gap-4 overflow-hidden">
          <Card className="flex-1 flex flex-col h-full overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Prompt Template Editor</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewTemplateDialogOpen(true)}
                  >
                    ➕ New
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCopyDialogOpen(true)}
                    disabled={!selectedTemplate}
                  >
                    📋 Copy
                  </Button>
                  {selectedTemplate && selectedTemplate.isSystem !== 'true' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeleteTemplate}
                      className="text-destructive"
                    >
                      🗑️ Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 h-[100%] flex-1 overflow-hidden">
              {/* Template Selection Dropdown */}
              <div>
                <label className="text-xs uppercase text-muted-foreground">Template</label>
                <Select
                  value={selectedId ? String(selectedId) : ''}
                  onValueChange={handleSelectTemplate}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? 'Loading...' : 'Select a template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={String(tpl.id)}>
                        <div className="flex flex-col items-start">
                          <span className="font-semibold">
                            {tpl.name}
                            {tpl.isSystem === 'true' && (
                              <span className="ml-2 text-xs text-muted-foreground">[System]</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{tpl.key}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name Input */}
              <div>
                <label className="text-xs uppercase text-muted-foreground">Template Name</label>
                <Input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder="Template name"
                  disabled={!selectedTemplate || saving}
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="text-xs uppercase text-muted-foreground">Description</label>
                <Input
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  placeholder="Prompt description"
                  disabled={!selectedTemplate || saving}
                />
              </div>

              {/* Template Text Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <label className="text-xs uppercase text-muted-foreground">Template Text</label>
                <textarea
                  className="flex-1 w-full rounded-md border bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                  value={templateDraft}
                  onChange={(event) => setTemplateDraft(event.target.value)}
                  disabled={!selectedTemplate || saving}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between mt-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewDialogOpen(true)}
                  disabled={!selectedTemplate || saving}
                >
                  💡 Preview Filled
                </Button>
                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} disabled={!selectedTemplate || saving}>
                    Save Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Binding Management */}
        <Card className="flex flex-col w-full lg:w-[40rem] flex-shrink-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Account Prompt Bindings</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-6">
            {/* Bindings Table */}
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Template</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((binding) => (
                    <tr key={binding.id} className="border-t">
                      <td className="py-2 pr-4">{binding.accountName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {binding.accountModel || '—'}
                      </td>
                      <td className="py-2 pr-4">{binding.promptName}</td>
                      <td className="py-2 pr-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBinding(binding)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteBinding(binding.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {bindings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">
                        No prompt bindings configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Binding Form */}
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs uppercase text-muted-foreground">
                    AI Trader
                  </label>
                  <Select
                    value={
                      bindingForm.accountId !== undefined ? String(bindingForm.accountId) : ''
                    }
                    onValueChange={(value) =>
                      setBindingForm((prev) => ({
                        ...prev,
                        accountId: Number(value),
                      }))
                    }
                    disabled={accountsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={accountsLoading ? 'Loading...' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name}
                          {account.model ? ` (${account.model})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs uppercase text-muted-foreground">Template</label>
                  <Select
                    value={
                      bindingForm.promptTemplateId !== undefined
                        ? String(bindingForm.promptTemplateId)
                        : ''
                    }
                    onValueChange={(value) =>
                      setBindingForm((prev) => ({
                        ...prev,
                        promptTemplateId: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={String(tpl.id)}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setBindingForm(DEFAULT_BINDING_FORM)}
                  disabled={bindingSaving}
                >
                  Reset
                </Button>
                <Button onClick={handleBindingSubmit} disabled={bindingSaving}>
                  Save Binding
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

      {/* Preview Dialog */}
      {selectedTemplate && (
        <PromptPreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          templateKey={selectedTemplate.key}
          templateName={selectedTemplate.name}
          templateText={templateDraft}
        />
      )}

      {/* New Template Dialog */}
      <Dialog open={newTemplateDialogOpen} onOpenChange={setNewTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a new prompt template from scratch. It will be initialized with the default
              template content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="My Custom Template"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Description of this template"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={creating}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Template Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Template</DialogTitle>
            <DialogDescription>
              Create a copy of "{selectedTemplate?.name}". You can specify a new name or leave
              blank to auto-generate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">New Name (Optional)</label>
              <Input
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                placeholder={`${selectedTemplate?.name} (Copy)`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyTemplate} disabled={copying}>
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
