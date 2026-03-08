import React, { useEffect, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { getDistance } from 'geolib'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const BRAND_SUGGESTIONS = [
  'Toyota',
  'Honda',
  'Ford',
  'Hyundai',
  'Kia',
  'BMW',
  'Mercedes',
  'Audi',
  'Nissan',
  'Chevrolet',
]

export default function ServiceLocator({ brand = '', mapOnly = false }) {
  const [userPos, setUserPos] = useState(null)
  const [pois, setPois] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [brandInput, setBrandInput] = useState(brand)
  const [searchBrand, setSearchBrand] = useState(brand)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => setUserPos([position.coords.latitude, position.coords.longitude]),
      () => setError('Location permission denied or unavailable'),
    )
  }, [])

  useEffect(() => {
    if (!userPos) {
      return
    }

    if (!searchBrand) {
      setPois([])
      return
    }

    const [lat, lon] = userPos

    const fetchPois = async () => {
      setLoading(true)
      setError(null)

      try {
        const radii = [15000, 10000, 5000]
        const endpoints = [
          'https://overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter',
          'https://overpass.openstreetmap.fr/api/interpreter',
        ]
        const safeBrand = String(searchBrand).replace(/[\n\r]/g, ' ').trim()
        const brandFilter = safeBrand ? `["brand"~"${safeBrand}",i]` : ''
        const cacheKeyBase = `overpass:${lat.toFixed(4)}:${lon.toFixed(4)}:${safeBrand}`
        const cacheTtl = 1000 * 60 * 15

        for (const radius of radii) {
          const cacheKey = `${cacheKeyBase}:${radius}`

          try {
            const cachedValue = localStorage.getItem(cacheKey)
            if (cachedValue) {
              const cached = JSON.parse(cachedValue)

              if (Date.now() - cached.ts < cacheTtl) {
                setPois(cached.elements)

                if (mapRef.current && cached.elements.length > 0) {
                  const bounds = L.latLngBounds(cached.elements.map((element) => [element.lat, element.lon]))
                  mapRef.current.fitBounds(bounds.pad ? bounds.pad(0.2) : bounds)
                }

                return
              }
            }
          } catch (cacheError) {
            console.debug('Unable to read cached service-locator results.', cacheError)
          }

          const query = `[out:json][timeout:60];
(
  node["shop"="car_repair"]${brandFilter}(around:${radius},${lat},${lon});
  node["amenity"="car_repair"]${brandFilter}(around:${radius},${lat},${lon});
  node["office"="car_dealership"]${brandFilter}(around:${radius},${lat},${lon});
  way["shop"="car_repair"]${brandFilter}(around:${radius},${lat},${lon});
  relation["shop"="car_repair"]${brandFilter}(around:${radius},${lat},${lon});
);
out center;`

          let lastError = null

          for (const endpoint of endpoints) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
              try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 30000 + attempt * 15000)

                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain' },
                  body: query,
                  signal: controller.signal,
                })

                clearTimeout(timeoutId)

                if (!response.ok) {
                  lastError = new Error(`Overpass API error: ${response.status}`)
                  continue
                }

                const payload = await response.json()
                const elements = (payload.elements || [])
                  .map((element) => {
                    const elementLat = element.lat ?? element.center?.lat
                    const elementLon = element.lon ?? element.center?.lon
                    return { ...element, lat: elementLat, lon: elementLon }
                  })
                  .filter((element) => element.lat && element.lon)

                elements.forEach((element) => {
                  element.distance = getDistance(
                    { latitude: lat, longitude: lon },
                    { latitude: element.lat, longitude: element.lon },
                  )
                })

                elements.sort((left, right) => (left.distance || 0) - (right.distance || 0))
                setPois(elements)

                try {
                  localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), elements }))
                } catch (storageError) {
                  console.debug('Unable to store cached service-locator results.', storageError)
                }

                if (mapRef.current && elements.length > 0) {
                  const bounds = L.latLngBounds(elements.map((element) => [element.lat, element.lon]))
                  mapRef.current.fitBounds(bounds.pad ? bounds.pad(0.2) : bounds)
                }

                return
              } catch (requestError) {
                lastError = requestError
                await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 1000))
              }
            }
          }

          if (!lastError) {
            return
          }
        }

        throw new Error('Overpass query failed or timed out. Try again later or use a server proxy.')
      } catch (requestError) {
        setError(requestError.message || String(requestError))
      } finally {
        setLoading(false)
      }
    }

    fetchPois()
  }, [searchBrand, userPos])

  const nearest = pois[0]

  if (error) {
    return (
      <div style={{ padding: 12 }}>
        <div
          style={{
            background: '#ffe6e6',
            border: '1px solid #ffb3b3',
            padding: 12,
            borderRadius: 6,
          }}
        >
          <strong style={{ color: '#b30000' }}>Error:</strong>
          <div style={{ marginTop: 8 }}>{error}</div>
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                setError(null)
                setSearchBrand(brandInput)
              }}
              style={{ marginRight: 8 }}
            >
              Retry
            </button>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      </div>
    )
  }

  if (!userPos) {
    return <div>Waiting for location, please allow location access.</div>
  }

  if (mapOnly) {
    return (
      <div style={{ height: '80vh' }}>
        <MapContainer
          ref={mapRef}
          center={userPos}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={userPos}>
            <Popup>Your location</Popup>
          </Marker>
          {pois.map((poi, index) => (
            <Marker key={poi.id || index} position={[poi.lat, poi.lon]}>
              <Popup>
                <b>{poi.tags?.name || poi.tags?.brand || 'Service'}</b>
                <br />
                {poi.tags?.addr_street || ''}
                <br />
                {poi.distance ? `${Math.round((poi.distance / 1000) * 100) / 100} km` : ''}
              </Popup>
            </Marker>
          ))}
          {nearest && (
            <Circle
              center={[nearest.lat, nearest.lon]}
              radius={Math.max(nearest.distance || 100, 100)}
              pathOptions={{ color: 'blue', weight: 1 }}
            />
          )}
        </MapContainer>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 420, maxHeight: 560, overflow: 'auto' }}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setSearchBrand(brandInput)
          }}
          style={{ marginBottom: 12 }}
        >
          <label style={{ display: 'block', marginBottom: 6 }}>Search service centres for brand:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              list="brand-suggestions"
              value={brandInput}
              onChange={(event) => setBrandInput(event.target.value)}
              placeholder="e.g. Toyota, Ford, Honda"
              style={{ flex: 1, padding: '6px 8px' }}
              aria-label="Car brand"
            />
            <datalist id="brand-suggestions">
              {BRAND_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <button type="submit" disabled={loading || !brandInput.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <h3 style={{ marginTop: 6 }}>
          Nearby Service Centres {searchBrand ? `for "${searchBrand}"` : ''}
        </h3>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 50 50" style={{ display: 'inline-block' }}>
              <path
                fill="#333"
                d="M43.935,25.145c0-10.318-8.364-18.682-18.682-18.682c-10.318,0-18.682,8.364-18.682,18.682h4.068
                  c0-8.062,6.551-14.613,14.614-14.613c8.062,0,14.613,6.551,14.613,14.613H43.935z"
              >
                <animateTransform
                  attributeType="xml"
                  attributeName="transform"
                  type="rotate"
                  from="0 25 25"
                  to="360 25 25"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
            <div>Searching nearby service centres...</div>
          </div>
        )}
        {!loading && searchBrand && pois.length === 0 && <div>No results found within search radius.</div>}
        {!searchBrand && (
          <div style={{ marginBottom: 8 }}>
            Enter a car brand above and click Search to locate official service centres.
          </div>
        )}
        <div style={{ marginBottom: 8, color: '#666' }}>{pois.length > 0 ? `Found ${pois.length} result(s)` : ''}</div>
        <ul style={{ paddingLeft: 12 }}>
          {pois.map((poi, index) => (
            <li
              key={poi.id || index}
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => {
                mapRef.current?.setView([poi.lat, poi.lon], 15)
              }}
            >
              <b>{poi.tags?.name || poi.tags?.brand || 'Service'}</b>
              <br />
              {poi.tags?.addr_street || ''} {poi.tags?.addr_housenumber || ''}
              <br />
              {poi.distance ? `${Math.round((poi.distance / 1000) * 100) / 100} km` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ flex: 1, height: 560 }}>
        <MapContainer ref={mapRef} center={userPos} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={userPos}>
            <Popup>Your location</Popup>
          </Marker>
          {pois.map((poi, index) => (
            <Marker key={poi.id || index} position={[poi.lat, poi.lon]}>
              <Popup>
                <b>{poi.tags?.name || poi.tags?.brand || 'Service'}</b>
                <br />
                {poi.tags?.addr_street || ''}
                <br />
                {poi.distance ? `${Math.round((poi.distance / 1000) * 100) / 100} km` : ''}
              </Popup>
            </Marker>
          ))}
          {nearest && (
            <Circle
              center={[nearest.lat, nearest.lon]}
              radius={Math.max(nearest.distance || 100, 100)}
              pathOptions={{ color: 'blue', weight: 1 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
