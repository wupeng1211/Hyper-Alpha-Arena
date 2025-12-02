# Ottimizzazione Prompt per DeepSeek

**Data:** 02/12/2025, 01:52 AM
**Problema:** Errore `AI_API_ALL_ENDPOINTS_FAILED` con DeepSeek API
**Causa:** Prompt troppo lungo che supera i limiti di contesto

---

## Modifiche Applicate

### File Modificato
- `prompts/trading_prompt_alpha_arena.md`

### Ottimizzazioni Implementate

1. **Rimozione K-Line 1h** (4 variabili eliminate)
   - ❌ `{BTC_klines_1h}`
   - ❌ `{ETH_klines_1h}`
   - ❌ `{SOL_klines_1h}`
   - ❌ `{DOGE_klines_1h}`

2. **Riduzione Candele K-Line 15m** (da 500 a 200)
   - ✅ `{BTC_klines_15m}(200)`
   - ✅ `{ETH_klines_15m}(200)`
   - ✅ `{SOL_klines_15m}(200)`
   - ✅ `{DOGE_klines_15m}(200)`

3. **Mantenuti** (nessuna modifica)
   - ✅ `{BTC_market_data}` (e per ETH, SOL, DOGE)
   - ✅ `{BTC_RSI14_15m}` (e per ETH, SOL, DOGE)
   - ✅ `{BTC_MACD_15m}` (e per ETH, SOL, DOGE)
   - ✅ `{BTC_EMA_15m}` (e per ETH, SOL, DOGE)
   - ✅ `{BTC_ATR14_15m}` (e per ETH, SOL, DOGE)

---

## Impatto sulla Lunghezza

### Stima Riduzione Token

| Componente | Token Risparmiati |
|------------|-------------------|
| Rimozione K-line 1h (4 × 500 candele) | ~30,000 |
| Riduzione K-line 15m (4 × 300 candele) | ~18,000 |
| **TOTALE RISPARMIO** | **~48,000 token** |

### Confronto Prima/Dopo

| Versione | Token Stimati | % Riduzione |
|----------|---------------|-------------|
| **Prima** | ~80,000-100,000 | - |
| **Dopo** | ~32,000-40,000 | **50-60%** |

---

## Limiti DeepSeek

- **Modello:** `deepseek-chat`
- **Limite Contesto:** ~64K token
- **Timeout:** 120 secondi (modelli non-reasoning)
- **Endpoint:** 
  - `https://api.deepseek.com/chat/completions`
  - `https://api.deepseek.com/v1/chat/completions`

---

## Risultati Test

### Test Generazione Prompt (02/12/2025, 01:54 AM)

✅ **Prompt generato correttamente** con le ottimizzazioni applicate:
- K-Line 15m: 200 candele per simbolo (BTC, ETH, SOL, DOGE)
- K-Line 1h: Rimossa completamente
- Market data: Mantenuto per tutti i simboli
- Indicatori: RSI14, MACD, EMA, ATR mantenuti

### Lunghezza Prompt Generato

**Sezioni principali:**
- Session Context: ~500 token
- Account State: ~300 token
- Open Positions: ~200 token
- K-Line Data (4 simboli × 200 candele): ~24,000 token
- Indicatori (4 simboli × 4 indicatori): ~2,000 token
- Market Prices & Sampling: ~1,500 token
- News & Instructions: ~3,500 token

**Totale stimato: ~32,000 token** (ben sotto il limite di 64K di DeepSeek)

## Prossimi Passi

1. ✅ Modifiche applicate al prompt
2. ✅ Test generazione prompt completato
3. ⏳ Monitorare errori DeepSeek API in produzione
4. ⏳ Verificare qualità delle decisioni AI
5. ⏳ Se l'errore persiste, considerare ulteriori ottimizzazioni

---

## Note Tecniche

### Logica di Retry nel Codice
Il sistema prova automaticamente:
- 3 retry per endpoint
- 2 endpoint diversi
- Exponential backoff con jitter
- Gestione rate limiting (429)

### Variabili K-Line
Le variabili K-line supportano il parametro `(N)` per specificare il numero di candele:
- Sintassi: `{SYMBOL_klines_PERIOD}(COUNT)`
- Esempio: `{BTC_klines_15m}(200)` → 200 candele
- Default: 500 candele se non specificato

### Calcolo Indicatori
Gli indicatori tecnici vengono calcolati su 500 candele per accuratezza, ma solo le ultime N vengono mostrate nel prompt per ridurre i token.
