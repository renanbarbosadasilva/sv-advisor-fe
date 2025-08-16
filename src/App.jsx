import { useEffect, useMemo, useState } from 'react'
import './App.css'

function numberOrNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Basic auth state
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('basicAuth') || '')
  const [login, setLogin] = useState({ username: '', password: '', error: '', loading: false })

  const getAuthHeader = () => (authToken ? { Authorization: `Basic ${authToken}` } : {})
  const clearAuth = () => {
    localStorage.removeItem('basicAuth')
    setAuthToken('')
  }

  const [filters, setFilters] = useState({
    brand: '',
    fuelType: '',
    gearbox: '',
    yearMin: '',
    yearMax: '',
    priceMin: '',
    priceMax: '',
    diffMax: '',
    text: '',
    onlyMissing: false,
  })

  // Sorting state: key corresponds to a field, dir is 'asc' | 'desc'
  const [sort, setSort] = useState({ key: 'advertCreatedAt', dir: 'desc' })

  // Request sorting by a given key; toggle direction if already active
  const requestSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }

  const renderSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  const initialFilters = {
    brand: '',
    fuelType: '',
    gearbox: '',
    yearMin: '',
    yearMax: '',
    priceMin: '',
    priceMax: '',
    diffMax: '',
    text: '',
    onlyMissing: false,
  }

  const fetchData = async (reset = false) => {
    if (!authToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sent-adverts', { headers: { ...getAuthHeader() } })
      if (res.status === 401) {
        // Unauthorized: force login
        clearAuth()
        setLogin((prev) => ({ ...prev, error: 'Session expired or unauthorized. Please log in.' }))
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // Ensure expected shape; default to []
      setData(Array.isArray(json) ? json : [])
      if (reset) {
        setFilters(initialFilters)
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  // Load data when authenticated
  useEffect(() => {
    if (authToken) {
      // Reset filters on first (auth) load to avoid browser autofill/stale state
      fetchData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken])

  const uniqueValues = useMemo(() => {
    const brands = new Set()
    const fuels = new Set()
    const gearboxes = new Set()
    data.forEach((d) => {
      if (d.brand) brands.add(d.brand)
      if (d.fuelType) fuels.add(d.fuelType)
      if (d.gearbox) gearboxes.add(d.gearbox)
    })
    return {
      brands: Array.from(brands).sort(),
      fuels: Array.from(fuels).sort(),
      gearboxes: Array.from(gearboxes).sort(),
    }
  }, [data])

  // Ensure dropdown filters are valid with current options; if not, clear them.
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev }
      if (next.brand && !uniqueValues.brands.includes(next.brand)) next.brand = ''
      if (next.fuelType && !uniqueValues.fuels.includes(next.fuelType)) next.fuelType = ''
      if (next.gearbox && !uniqueValues.gearboxes.includes(next.gearbox)) next.gearbox = ''
      return next
    })
  }, [uniqueValues.brands, uniqueValues.fuels, uniqueValues.gearboxes])

  const filtered = useMemo(() => {
    const yMin = numberOrNull(filters.yearMin)
    const yMax = numberOrNull(filters.yearMax)
    const pMin = numberOrNull(filters.priceMin)
    const pMax = numberOrNull(filters.priceMax)
    const dMax = numberOrNull(filters.diffMax)
    const q = filters.text.trim().toLowerCase()

    let result = data.filter((d) => {
      if (filters.brand && d.brand !== filters.brand) return false
      if (filters.fuelType && d.fuelType !== filters.fuelType) return false
      if (filters.gearbox && d.gearbox !== filters.gearbox) return false
      if (yMin != null && Number(d.year) < yMin) return false
      if (yMax != null && Number(d.year) > yMax) return false
      if (pMin != null && Number(d.price) < pMin) return false
      if (pMax != null && Number(d.price) > pMax) return false
      if (dMax != null && Number(d.diffPriceMinPrice) > dMax) return false
      if (q) {
        const hay = `${d.title || ''} ${d.brand || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.onlyMissing) {
        const missingFields = ['advertId','minPrice','maxPrice','diffPriceMinPrice','lastDifference','minPrice20Below','minPrice30Below','minPrice25Below']
        const hasMissing = missingFields.some((k) => d?.[k] == null)
        if (!hasMissing) return false
      }
      return true
    })

    // Sort by selected column and direction; null/empty values last
    const numericKeys = new Set(['price', 'minPrice', 'minPrice30Below', 'minPrice25Below', 'minPrice20Below', 'maxPrice', 'diffPriceMinPrice', 'year'])
    const key = sort.key
    const dir = sort.dir === 'asc' ? 1 : -1

    result.sort((a, b) => {
      const va = a?.[key]
      const vb = b?.[key]
      const aNull = va === undefined || va === null || (numericKeys.has(key) ? !Number.isFinite(Number(va)) : String(va).trim() === '')
      const bNull = vb === undefined || vb === null || (numericKeys.has(key) ? !Number.isFinite(Number(vb)) : String(vb).trim() === '')
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (numericKeys.has(key)) {
        const na = Number(va)
        const nb = Number(vb)
        if (na < nb) return -1 * dir
        if (na > nb) return 1 * dir
        return 0
      } else {
        const sa = String(va).toLowerCase()
        const sb = String(vb).toLowerCase()
        const cmp = sa.localeCompare(sb)
        return cmp * dir
      }
    })

    return result
  }, [data, filters, sort])

  const onInput = (e) => {
    const { name, value, type, checked } = e.target
    const v = type === 'checkbox' ? !!checked : value
    setFilters((prev) => ({ ...prev, [name]: v }))
  }

  const clearFilters = () => setFilters(initialFilters)

  // Login form handlers
  const onLoginChange = (e) => {
    const { name, value } = e.target
    setLogin((prev) => ({ ...prev, [name]: value }))
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setLogin((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const token = btoa(`${login.username}:${login.password}`)
      // Try a lightweight request to validate credentials
      const res = await fetch('/api/sent-adverts', { headers: { Authorization: `Basic ${token}` } })
      if (!res.ok) {
        const msg = res.status === 401 ? 'Invalid credentials' : `Login failed (HTTP ${res.status})`
        setLogin((prev) => ({ ...prev, loading: false, error: msg }))
        return
      }
      localStorage.setItem('basicAuth', token)
      setAuthToken(token)
      setLogin({ username: '', password: '', error: '', loading: false })
      // Data will be fetched via effect on authToken change
    } catch (e) {
      setLogin((prev) => ({ ...prev, loading: false, error: e.message || String(e) }))
    }
  }

  const logout = () => {
    clearAuth()
    setData([])
  }

  // If not authenticated, show login form
  if (!authToken) {
    return (
      <div style={{ textAlign: 'left', maxWidth: 420, margin: '40px auto' }}>
        <h1>StandVirtual Advisor</h1>
        <form onSubmit={submitLogin} style={{ display: 'grid', gap: 12 }}>
          <div>
            <label>Username: </label>
            <input name="username" value={login.username} onChange={onLoginChange} autoComplete="username" />
          </div>
          <div>
            <label>Password: </label>
            <input type="password" name="password" value={login.password} onChange={onLoginChange} autoComplete="current-password" />
          </div>
          {login.error && <div style={{ color: 'tomato' }}>Error: {login.error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={login.loading || !login.username || !login.password}>
              {login.loading ? 'Logging in…' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'left', maxWidth: 1200, margin: '0 auto' }}>
      <h1>StandVirtual Advisor</h1>
      

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end', marginBottom: 16 }}>
        <div>
          <label>Brand</label>
          <select name="brand" value={filters.brand} onChange={onInput} style={{ width: '100%' }} autoComplete="off">
            <option value="">All</option>
            {uniqueValues.brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Fuel</label>
          <select name="fuelType" value={filters.fuelType} onChange={onInput} style={{ width: '100%' }} autoComplete="off">
            <option value="">All</option>
            {uniqueValues.fuels.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Gearbox</label>
          <select name="gearbox" value={filters.gearbox} onChange={onInput} style={{ width: '100%' }} autoComplete="off">
            <option value="">All</option>
            {uniqueValues.gearboxes.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Year min</label>
          <input name="yearMin" value={filters.yearMin} onChange={onInput} placeholder="e.g. 2015" inputMode="numeric" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>Year max</label>
          <input name="yearMax" value={filters.yearMax} onChange={onInput} placeholder="e.g. 2021" inputMode="numeric" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>Price min (€)</label>
          <input name="priceMin" value={filters.priceMin} onChange={onInput} placeholder="e.g. 5000" inputMode="numeric" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>Price max (€)</label>
          <input name="priceMax" value={filters.priceMax} onChange={onInput} placeholder="e.g. 30000" inputMode="numeric" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>Max diff vs min (€)</label>
          <input name="diffMax" value={filters.diffMax} onChange={onInput} placeholder="e.g. 1000" inputMode="numeric" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>Search text</label>
          <input name="text" value={filters.text} onChange={onInput} placeholder="title or brand" style={{ width: '100%' }} autoComplete="off" />
        </div>
        <div>
          <label>
            <input type="checkbox" name="onlyMissing" checked={!!filters.onlyMissing} onChange={onInput} />{' '}
            Only without MinMax
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchData} disabled={loading}>Refresh</button>
          <button onClick={clearFilters} disabled={loading}>Clear</button>
          <button onClick={logout} disabled={loading} style={{ marginLeft: 'auto' }}>Logout</button>
        </div>
      </section>

      <section style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        {loading && <span>Loading…</span>}
        {error && <span style={{ color: 'tomato' }}>Error: {error}</span>}
        <span style={{ marginLeft: 'auto' }}>Showing {filtered.length} of {data.length}</span>
      </section>

      <div className="table-container" style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th onClick={() => requestSort('title')} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Title{renderSort('title')}</th>
              <th onClick={() => requestSort('advertCreatedAt')} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Created{renderSort('advertCreatedAt')}</th>
              <th onClick={() => requestSort('price')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Price (€){renderSort('price')}</th>
              <th onClick={() => requestSort('minPrice')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Min (€){renderSort('minPrice')}</th>
              <th onClick={() => requestSort('minPrice20Below')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Min 20% (€){renderSort('minPrice20Below')}</th>
              <th onClick={() => requestSort('minPrice25Below')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Min 25% (€){renderSort('minPrice25Below')}</th>
              <th onClick={() => requestSort('minPrice30Below')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Min 30% (€){renderSort('minPrice30Below')}</th>
              <th onClick={() => requestSort('maxPrice')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Max (€){renderSort('maxPrice')}</th>
              <th onClick={() => requestSort('diffPriceMinPrice')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Diff vs Min (€){renderSort('diffPriceMinPrice')}</th>
              <th onClick={() => requestSort('brand')} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Brand{renderSort('brand')}</th>
              <th onClick={() => requestSort('fuelType')} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Fuel{renderSort('fuelType')}</th>
              <th onClick={() => requestSort('gearbox')} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Gearbox{renderSort('gearbox')}</th>
              <th onClick={() => requestSort('year')} style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8, cursor: 'pointer', userSelect: 'none' }}>Year{renderSort('year')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, idx) => (
              <tr key={(d.trackingUrl || d.title || '') + idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8, maxWidth: 420 }}>
                  {d.trackingUrl ? (
                    <a href={d.trackingUrl} target="_blank" rel="noreferrer">{d.title || 'Open'}</a>
                  ) : (
                    d.title || '—'
                  )}
                </td>
                <td style={{ padding: 8 }}>{formatLisbonDate(d.advertCreatedAt)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(d.price)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(d.minPrice)}</td>
                <td style={{ padding: 8, textAlign: 'right' }} title={formatDiffTitle('Net', d.minPrice, d.minPrice20Below)}>{formatNumber(d.minPrice20Below)}</td>
                <td style={{ padding: 8, textAlign: 'right' }} title={formatDiffTitle('Net', d.minPrice, d.minPrice25Below)}>{formatNumber(d.minPrice25Below)}</td>
                <td style={{ padding: 8, textAlign: 'right' }} title={formatDiffTitle('Net', d.minPrice, d.minPrice30Below)}>{formatNumber(d.minPrice30Below)}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{formatNumber(d.maxPrice)}</td>
                <td style={{ padding: 8, textAlign: 'right', color: Number(d.diffPriceMinPrice) <= 0 ? 'green' : undefined }}>{formatNumber(d.diffPriceMinPrice)}</td>
                <td style={{ padding: 8 }}>{d.brand || '—'}</td>
                <td style={{ padding: 8 }}>{d.fuelType || '—'}</td>
                <td style={{ padding: 8 }}>{d.gearbox || '—'}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{d.year ?? '—'}</td>
              </tr>
            ))}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={13} style={{ padding: 24, textAlign: 'center', color: '#666' }}>No results match current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatLisbonDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
  const get = (type) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function formatNumber(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function formatDiffTitle(label, min, below) {
  const a = Number(min)
  const b = Number(below)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  const diff = a - b
  return `${label}: ${diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} €`
}

export default App
