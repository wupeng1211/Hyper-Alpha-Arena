/**
 * Wallet Configuration Panel for AI Traders
 * 
 * Refactored to support "API Agent" mode for better security.
 * Users now provide:
 * 1. Main Wallet Address (Public, holds funds)
 * 2. API Agent Private Key (Secret, only for signing)
 */

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Wallet, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  RefreshCw, 
  Trash2,
  ShieldCheck,
  Info
} from 'lucide-react'
import {
  getAccountWallet,
  configureAccountWallet,
  testWalletConnection,
  deleteAccountWallet,
} from '@/lib/hyperliquidApi'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// --- Types ---

interface WalletConfigPanelProps {
  accountId: number
  accountName: string
  onWalletConfigured?: () => void
}

interface WalletData {
  id?: number
  walletAddress?: string // Main wallet address
  isApiWallet?: boolean  // Flag to indicate this is set up via API key
  maxLeverage: number
  defaultLeverage: number
  balance?: {
    totalEquity: number
    availableBalance: number
    marginUsagePercent: number
  }
}

type Environment = 'testnet' | 'mainnet'

// --- Sub-Component: Wallet Card ---

interface WalletCardProps {
  environment: Environment
  wallet: WalletData | null
  loading: boolean
  onSave: (data: { walletAddress: string; apiPrivateKey: string; maxLeverage: number; defaultLeverage: number }) => Promise<void>
  onDelete: () => Promise<void>
  onTestConnection: () => Promise<void>
  isTestingConnection: boolean
}

const WalletCard = ({
  environment,
  wallet,
  loading,
  onSave,
  onDelete,
  onTestConnection,
  isTestingConnection
}: WalletCardProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  
  // Form State
  const [addressInput, setAddressInput] = useState('')
  const [apiPrivateKey, setApiPrivateKey] = useState('')
  const [maxLeverage, setMaxLeverage] = useState(3)
  const [defaultLeverage, setDefaultLeverage] = useState(1)

  const envLabel = environment === 'testnet' ? 'Testnet' : 'Mainnet'
  const badgeVariant = environment === 'testnet' ? 'secondary' : 'default'

  // Sync state when wallet data loads or edit mode is toggled
  useEffect(() => {
    if (wallet) {
      setAddressInput(wallet.walletAddress || '')
      setMaxLeverage(wallet.maxLeverage)
      setDefaultLeverage(wallet.defaultLeverage)
    } else {
      // Reset defaults for new config
      setAddressInput('')
      setApiPrivateKey('')
      setMaxLeverage(3)
      setDefaultLeverage(1)
    }
  }, [wallet, isEditing])

  const handleSaveInternal = async () => {
    await onSave({ 
      walletAddress: addressInput, 
      apiPrivateKey, 
      maxLeverage, 
      defaultLeverage 
    })
    setIsEditing(false)
    setApiPrivateKey('') // Clear key from memory after save
  }

  return (
    <div className="p-4 border rounded-lg space-y-3 bg-card text-card-foreground shadow-sm relative overflow-hidden">
      {/* Background decoration indicating secure mode */}
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <ShieldCheck className="h-24 w-24" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <Badge variant={badgeVariant} className="text-xs uppercase font-bold tracking-wider">
            {envLabel}
          </Badge>
        </div>
        {wallet && !isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={loading}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* VIEW MODE */}
      {wallet && !isEditing ? (
        <div className="space-y-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground font-medium">Main Wallet Address</label>
              <ShieldCheck className="h-3 w-3 text-green-600" aria-label="Secure" />
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 bg-muted/50 rounded text-xs font-mono truncate border">
                {wallet.walletAddress}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  navigator.clipboard.writeText(wallet.walletAddress || '')
                  toast.success('Address copied')
                }}
              >
                <CheckCircle className="h-4 w-4 text-muted-foreground hover:text-green-600" />
              </Button>
            </div>
          </div>

          {wallet.balance && (
            <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2 rounded-md border border-border/50">
              <div>
                <div className="text-muted-foreground">Equity</div>
                <div className="font-semibold">${wallet.balance.totalEquity.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Available</div>
                <div className="font-semibold">${wallet.balance.availableBalance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Margin</div>
                <div className="font-semibold">{wallet.balance.marginUsagePercent.toFixed(1)}%</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/20 p-1.5 rounded">
              <span className="text-muted-foreground">Max Lev: </span>
              <span className="font-medium">{wallet.maxLeverage}x</span>
            </div>
            <div className="bg-muted/20 p-1.5 rounded">
              <span className="text-muted-foreground">Def Lev: </span>
              <span className="font-medium">{wallet.defaultLeverage}x</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="w-full hover:bg-primary/5 hover:text-primary"
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Verifying Access...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        </div>
      ) : (
        // EDIT / CREATE MODE
        <div className="space-y-3 relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {!wallet && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Recommended:</strong> Use an API Agent. Enter your Main Wallet address below, and the Private Key of the authorized Agent.
              </span>
            </div>
          )}

          {/* Main Wallet Address Input */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Main Wallet Address</label>
            <Input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="0x... (Your fund wallet)"
              className="font-mono text-xs h-8"
              // If we are strictly editing leverage, maybe disable this, 
              // but user might want to fix a typo, so we keep enabled.
            />
          </div>

          {/* API Private Key Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">API Agent Private Key</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      The private key of the authorized API Agent, NOT your main wallet. 
                      It starts with 0x and is 66 characters long.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                placeholder="0x... (Agent secret)"
                className="font-mono text-xs h-8 pr-8"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Max Lev.</label>
              <Input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(Number(e.target.value))}
                min={1}
                max={50}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Def. Lev.</label>
              <Input
                type="number"
                value={defaultLeverage}
                onChange={(e) => setDefaultLeverage(Number(e.target.value))}
                min={1}
                max={maxLeverage}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveInternal}
              disabled={loading}
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save Securely'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false)
                setApiPrivateKey('')
                // Reset address if cancelling an edit
                if (wallet) setAddressInput(wallet.walletAddress || '')
              }}
              size="sm"
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export default function WalletConfigPanel({
  accountId,
  accountName,
  onWalletConfigured
}: WalletConfigPanelProps) {
  const [testnetWallet, setTestnetWallet] = useState<WalletData | null>(null)
  const [mainnetWallet, setMainnetWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(false)
  
  const [testingTestnet, setTestingTestnet] = useState(false)
  const [testingMainnet, setTestingMainnet] = useState(false)

  useEffect(() => {
    if (accountId) loadWalletInfo()
  }, [accountId])

  const loadWalletInfo = async () => {
    try {
      setLoading(true)
      const info = await getAccountWallet(accountId)
      setTestnetWallet(info.testnetWallet || null)
      setMainnetWallet(info.mainnetWallet || null)
    } catch (error) {
      console.error('Failed to load wallet info:', error)
      toast.error('Failed to load wallet information')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWallet = async (
    environment: Environment,
    data: { walletAddress: string; apiPrivateKey: string; maxLeverage: number; defaultLeverage: number }
  ) => {
    const { walletAddress, apiPrivateKey, maxLeverage, defaultLeverage } = data

    // 1. Validate Main Wallet Address
    if (!walletAddress.trim() || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      toast.error('Invalid Main Wallet Address. Must be a 42-char Ethereum address.')
      return
    }

    // 2. Validate API Private Key
    // Note: If user is "Editing" existing wallet, they might not enter key if they just want to change Leverage.
    // Logic below assumes if key is empty, we keep existing key on backend. 
    // BUT for "Security First", we usually require key again or handle "Update Leverage Only".
    // For this example, if it's a NEW wallet, Key is required.
    
    // Check if we are creating new or updating (Updating logic depends on backend)
    // Here we strictly validate key if provided, or if address doesn't exist yet.
    const isNewWallet = environment === 'testnet' ? !testnetWallet : !mainnetWallet;
    
    if (isNewWallet && !apiPrivateKey) {
      toast.error('API Agent Private Key is required for new setup.')
      return
    }

    if (apiPrivateKey) {
      if (!apiPrivateKey.startsWith('0x') || apiPrivateKey.length !== 66) {
        toast.error('Invalid API Private Key format. Must be 0x + 64 hex chars.')
        return
      }
    }

    if (maxLeverage < 1 || maxLeverage > 50) {
      toast.error('Max leverage must be between 1 and 50')
      return
    }

    try {
      setLoading(true)
      const result = await configureAccountWallet(accountId, {
        walletAddress,   // Now explicitly sending address
        apiPrivateKey,   // Sending the agent key separately
        maxLeverage,
        defaultLeverage,
        environment
      })

      if (result.success) {
        toast.success(`${environment === 'testnet' ? 'Testnet' : 'Mainnet'} configured successfully!`)
        await loadWalletInfo()
        onWalletConfigured?.()
      } else {
        toast.error(result.error || 'Failed to configure wallet')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to configure wallet'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Connection testing logic remains similar, but API now uses the stored Agent Key
  // to check balance of the stored Wallet Address.
  const handleTestConnection = async (environment: Environment) => {
    const setTestingState = environment === 'testnet' ? setTestingTestnet : setTestingMainnet
    
    try {
      setTestingState(true)
      const result = await testWalletConnection(accountId, environment)

      if (result.success && result.connection === 'successful') {
        const equity = result.accountState?.totalEquity 
          ? `$${result.accountState.totalEquity.toFixed(2)}` 
          : 'Unknown'
          
        toast.success(`✅ Connected! Main Wallet Equity: ${equity}`)
        loadWalletInfo()
      } else {
        toast.error(`❌ Connection failed: ${result.error || 'Check API Key permissions'}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connection test failed')
    } finally {
      setTestingState(false)
    }
  }

  // Delete logic remains same...
  const handleDeleteWallet = async (environment: Environment) => {
    if (!confirm(`Are you sure you want to remove the ${environment} configuration?`)) return
    
    try {
      setLoading(true)
      const res = await deleteAccountWallet(accountId, environment)
      if (res.success) {
        toast.success('Wallet configuration removed')
        loadWalletInfo()
        onWalletConfigured?.()
      } else {
        toast.error('Failed to remove wallet')
      }
    } catch (e) {
      toast.error('Error removing wallet')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !testnetWallet && !mainnetWallet) {
    return (
      <div className="p-8 border rounded-lg bg-card flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <h4 className="text-sm font-semibold">Secure Wallet Configuration</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure API Agents for automated trading. Your funds remain in your main wallet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WalletCard
          environment="testnet"
          wallet={testnetWallet}
          loading={loading}
          isTestingConnection={testingTestnet}
          onSave={(data) => handleSaveWallet('testnet', data)}
          onDelete={() => handleDeleteWallet('testnet')}
          onTestConnection={() => handleTestConnection('testnet')}
        />

        <WalletCard
          environment="mainnet"
          wallet={mainnetWallet}
          loading={loading}
          isTestingConnection={testingMainnet}
          onSave={(data) => handleSaveWallet('mainnet', data)}
          onDelete={() => handleDeleteWallet('mainnet')}
          onTestConnection={() => handleTestConnection('mainnet')}
        />
      </div>
    </div>
  )
}
