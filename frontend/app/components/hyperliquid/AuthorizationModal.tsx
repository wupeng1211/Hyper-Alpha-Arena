import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  approveBuilder,
  checkBuilderAuthorization,
  disableTrading,
  UnauthorizedAccount
} from '@/lib/api'

interface AuthorizationModalProps {
  isOpen: boolean
  onClose: () => void
  unauthorizedAccounts: UnauthorizedAccount[]
  onAuthorizationComplete: () => void
}

const HyperliquidLogo = () => (
  <svg width="24" height="24" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mx-1">
    <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" fill="#072723"/>
  </svg>
)

interface AccountAuthState {
  authorizing: boolean
  authorized: boolean
  error?: string
}

export default function AuthorizationModal({
  isOpen,
  onClose,
  unauthorizedAccounts,
  onAuthorizationComplete
}: AuthorizationModalProps) {
  const [accountStates, setAccountStates] = useState<Record<number, AccountAuthState>>({})
  const [closing, setClosing] = useState(false)

  if (!isOpen) return null

  const getAccountState = (accountId: number): AccountAuthState => {
    return accountStates[accountId] || { authorizing: false, authorized: false }
  }

  const updateAccountState = (accountId: number, updates: Partial<AccountAuthState>) => {
    setAccountStates(prev => ({
      ...prev,
      [accountId]: { ...getAccountState(accountId), ...updates }
    }))
  }

  const handleAuthorize = async (account: UnauthorizedAccount) => {
    updateAccountState(account.account_id, { authorizing: true, error: undefined })
    try {
      // Step 1: Call approve builder API
      await approveBuilder(account.account_id)

      // Step 2: Verify authorization
      const result = await checkBuilderAuthorization(account.wallet_address)
      if (result.authorized) {
        updateAccountState(account.account_id, { authorizing: false, authorized: true })

        // Check if all accounts are now authorized
        const allAuthorized = unauthorizedAccounts.every(acc =>
          acc.account_id === account.account_id || getAccountState(acc.account_id).authorized
        )
        if (allAuthorized) {
          // Auto-close modal after short delay to show success state
          setTimeout(() => {
            onAuthorizationComplete()
          }, 500)
        }
      } else {
        updateAccountState(account.account_id, {
          authorizing: false,
          error: 'Authorization verification failed. Please try again.'
        })
      }
    } catch (error) {
      updateAccountState(account.account_id, {
        authorizing: false,
        error: error instanceof Error ? error.message : 'Authorization failed'
      })
    }
  }

  const handleClose = async () => {
    setClosing(true)
    const unauthorizedIds = unauthorizedAccounts
      .filter(acc => !getAccountState(acc.account_id).authorized)
      .map(acc => acc.account_id)

    for (const accountId of unauthorizedIds) {
      try {
        await disableTrading(accountId)
      } catch (error) {
        console.error(`Failed to disable trading for account ${accountId}:`, error)
      }
    }
    setClosing(false)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-background border rounded-lg shadow-lg w-[700px] max-w-[95vw] mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-1">
              <span>AI Trading requires</span>
              <HyperliquidLogo />
              <span>Hyperliquid authorization</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={closing}
              className="h-8 w-8 p-0 flex-shrink-0 ml-2"
            >
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            This authorization is only for platform trading and does not involve withdrawals or other sensitive operations.
          </p>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {unauthorizedAccounts.map((account) => {
            const state = getAccountState(account.account_id)
            return (
              <div
                key={account.account_id}
                className={`p-4 rounded-lg border ${
                  state.authorized
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{account.account_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {account.wallet_address.slice(0, 10)}...{account.wallet_address.slice(-8)}
                    </p>
                  </div>
                  {state.authorized && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>

                {state.error && (
                  <p className="text-sm text-red-500 mb-3">{state.error}</p>
                )}

                {!state.authorized && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAuthorize(account)}
                    disabled={state.authorizing}
                    className="w-full"
                  >
                    {state.authorizing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Authorizing...
                      </>
                    ) : (
                      'Authorize'
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Closing this dialog will disable AI trading for unauthorized accounts
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
