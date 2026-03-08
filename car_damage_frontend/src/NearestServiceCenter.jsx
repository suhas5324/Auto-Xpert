import React, { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CallRoundedIcon from '@mui/icons-material/CallRounded'
import DirectionsRoundedIcon from '@mui/icons-material/DirectionsRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { MapContainer, Marker, Polyline, Popup, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { buildApiUrl } from './config'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

function MapViewportController({ location, route, selectedCentre }) {
  const map = useMap()

  React.useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route, { padding: [36, 36] })
      return
    }

    if (selectedCentre) {
      map.flyTo([selectedCentre.lat, selectedCentre.lon], 14, {
        animate: true,
        duration: 1.1,
      })
      return
    }

    if (location) {
      map.flyTo(location, 13, {
        animate: true,
        duration: 1,
      })
    }
  }, [location, map, route, selectedCentre])

  return null
}

function detailValue(value, fallback = 'Not available yet') {
  if (!value || value === 'N/A') {
    return fallback
  }

  return value
}

async function fetchJson(path, fallbackMessage) {
  const response = await fetch(buildApiUrl(path))

  if (!response.ok) {
    throw new Error(fallbackMessage)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

export default function NearestServiceCenter() {
  const [location, setLocation] = useState(null)
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const [centres, setCentres] = useState([])
  const [selectedCentre, setSelectedCentre] = useState(null)
  const [route, setRoute] = useState([])
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState(null)

  const nearestDistance = centres[0]?.distance_km ? `${centres[0].distance_km} km` : 'Pending'

  const loadCentreInfo = async (centre, baseLocation = location) => {
    if (!baseLocation) {
      return
    }

    setSelectedCentre(centre)
    setDetailLoading(true)
    setError(null)

    try {
      const routeParams = new URLSearchParams({
        start_lat: String(baseLocation[0]),
        start_lon: String(baseLocation[1]),
        end_lat: String(centre.lat),
        end_lon: String(centre.lon),
      })
      const detailParams = new URLSearchParams({
        lat: String(centre.lat),
        lon: String(centre.lon),
      })

      const [routeData, detailData] = await Promise.all([
        fetchJson(`/api/route?${routeParams.toString()}`, 'Unable to load the route preview.'),
        fetchJson(
          `/api/centre-details?${detailParams.toString()}`,
          'Unable to load the selected centre details.',
        ),
      ])

      setRoute(Array.isArray(routeData.polyline) ? routeData.polyline : [])
      setDetails(detailData)
    } catch (requestError) {
      setRoute([])
      setDetails(null)
      setError(requestError.message || 'Unable to load the selected centre.')
    } finally {
      setDetailLoading(false)
    }
  }

  const findNearest = () => {
    setLoading(true)
    setError(null)
    setRoute([])
    setDetails(null)
    setSelectedCentre(null)
    setCentres([])

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        const accuracy = position.coords.accuracy
        const userLocation = [lat, lon]

        setLocation(userLocation)
        setLocationAccuracy(accuracy)

        try {
          const searchParams = new URLSearchParams({
            lat: String(lat),
            lon: String(lon),
          })

          const data = await fetchJson(
            `/api/nearest-centres?${searchParams.toString()}`,
            'Unable to fetch nearby service centres.',
          )

          const fetchedCentres = Array.isArray(data.centres) ? data.centres : []
          setCentres(fetchedCentres)

          if (!fetchedCentres.length) {
            setError('No nearby service centres were returned for this location.')
          } else {
            await loadCentreInfo(fetchedCentres[0], userLocation)
          }
        } catch (requestError) {
          setError(requestError.message || 'Failed to fetch nearby service centres.')
        } finally {
          setLoading(false)
        }
      },
      (geoError) => {
        let message = 'Failed to get your location.'

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            message = 'Location permission was denied. Allow access to search nearby centres.'
            break
          case geoError.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable right now.'
            break
          case geoError.TIMEOUT:
            message = 'The location request timed out. Try again in a moment.'
            break
          default:
            message = geoError.message || message
        }

        setError(message)
        setLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  const openDirections = (centre) => {
    if (!location || !centre) {
      return
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${location[0]},${location[1]}&destination=${centre.lat},${centre.lon}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ alignItems: { xs: 'flex-start', lg: 'center' } }}
      >
        <Box>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, mb: 1 }}>
            Nearby repair routing and service-centre discovery
          </Typography>
          <Typography sx={{ maxWidth: 760, color: 'text.secondary', lineHeight: 1.8 }}>
            Use the project map to find nearby service centres, review route details,
            and choose the next repair location for the detected damage.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={
            loading ? <CircularProgress size={18} color="inherit" /> : <MyLocationRoundedIcon />
          }
          onClick={findNearest}
          sx={{
            borderRadius: '18px',
            minHeight: 52,
            px: 2.5,
            boxShadow: '0 16px 34px rgba(29, 143, 122, 0.2)',
          }}
        >
          {loading ? 'Finding nearby centres...' : location ? 'Refresh my search' : 'Use my location'}
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.12fr 0.88fr' },
          gap: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            overflow: 'hidden',
            borderRadius: '30px',
            border: `1px solid ${alpha('#182433', 0.08)}`,
            background: 'rgba(255,255,255,0.88)',
          }}
        >
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              borderBottom: `1px solid ${alpha('#182433', 0.08)}`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,249,247,0.92))',
            }}
          >
            <Typography variant="h5" sx={{ mb: 0.8 }}>
              Live service map
            </Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
              The map shows the user location, nearby repair centres, and the route to
              the selected service option.
            </Typography>

            <Box
              sx={{
                mt: 2.25,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {[
                {
                  label: 'Centres found',
                  value: String(centres.length).padStart(2, '0'),
                },
                {
                  label: 'Closest distance',
                  value: nearestDistance,
                },
                {
                  label: 'Location accuracy',
                  value: locationAccuracy ? `${Math.round(locationAccuracy)} m` : 'Pending',
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 1.75,
                    borderRadius: '20px',
                    bgcolor: alpha('#182433', 0.04),
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                      fontWeight: 700,
                      fontSize: { xs: '1.15rem', md: '1.3rem' },
                    }}
                  >
                    {item.value}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {location && (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip
                  icon={<PlaceRoundedIcon />}
                  label={`${location[0].toFixed(4)}, ${location[1].toFixed(4)}`}
                  sx={{ borderRadius: '999px', bgcolor: alpha('#1d8f7a', 0.1), color: '#14695a' }}
                />
                {selectedCentre && (
                  <Chip
                    icon={<RouteRoundedIcon />}
                    label={selectedCentre.name}
                    sx={{ borderRadius: '999px', bgcolor: alpha('#ff6b4a', 0.1), color: '#b3452f' }}
                  />
                )}
              </Stack>
            )}
          </Box>

          {error && (
            <Alert severity="warning" sx={{ mx: 3, mt: 2.5, borderRadius: '18px' }}>
              {error}
            </Alert>
          )}

          <Box sx={{ height: { xs: 360, md: 540 }, mt: error ? 2 : 0 }}>
            {location ? (
              <MapContainer
                center={location}
                zoom={13}
                scrollWheelZoom
                className="service-map"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />

                <MapViewportController
                  location={location}
                  route={route}
                  selectedCentre={selectedCentre}
                />

                <CircleMarker
                  center={location}
                  radius={12}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#1d8f7a',
                    fillOpacity: 1,
                    weight: 4,
                  }}
                >
                  <Popup>Your current location</Popup>
                </CircleMarker>

                {centres.map((centre, index) => (
                  <Marker key={`${centre.name}-${index}`} position={[centre.lat, centre.lon]}>
                    <Popup>
                      <strong>{centre.name}</strong>
                      <br />
                      {centre.distance_km} km away
                    </Popup>
                  </Marker>
                ))}

                {route.length > 1 && (
                  <Polyline
                    positions={route}
                    pathOptions={{ color: '#ff6b4a', weight: 5, opacity: 0.8 }}
                  />
                )}
              </MapContainer>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  px: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, rgba(243,246,244,0.9), rgba(235,241,238,0.9))',
                }}
              >
                <Box>
                  <Typography variant="h5" sx={{ mb: 1 }}>
                    Enable location to start the repair search
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', maxWidth: 420, lineHeight: 1.75 }}>
                    Allow location access to find nearby vehicle service centres and route
                    the repair journey from your current position.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>

        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '28px',
              border: `1px solid ${alpha('#182433', 0.08)}`,
              background: 'rgba(255,255,255,0.88)',
            }}
          >
            <Typography variant="h5" sx={{ mb: 0.75 }}>
              Service centre shortlist
            </Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 2.25 }}>
              Review the nearest service centres returned by the project and select one
              to inspect route and repair details.
            </Typography>

            <Stack spacing={1.25}>
              {loading && !centres.length ? (
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: '22px',
                    bgcolor: alpha('#182433', 0.04),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography sx={{ color: 'text.secondary' }}>
                    Searching for nearby service centres...
                  </Typography>
                </Box>
              ) : centres.length > 0 ? (
                centres.map((centre, index) => {
                  const isSelected =
                    selectedCentre &&
                    selectedCentre.name === centre.name &&
                    selectedCentre.lat === centre.lat &&
                    selectedCentre.lon === centre.lon

                  return (
                    <Box
                      key={`${centre.name}-${index}`}
                      component="button"
                      type="button"
                      onClick={() => loadCentreInfo(centre)}
                      sx={{
                        width: '100%',
                        p: 2,
                        textAlign: 'left',
                        borderRadius: '22px',
                        border: `1px solid ${
                          isSelected ? alpha('#1d8f7a', 0.32) : alpha('#182433', 0.08)
                        }`,
                        bgcolor: isSelected ? alpha('#1d8f7a', 0.08) : '#fff',
                        cursor: 'pointer',
                        transition: 'transform 160ms ease, box-shadow 160ms ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 12px 28px rgba(24, 36, 51, 0.08)',
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography sx={{ fontWeight: 800, color: '#182433', mb: 0.45 }}>
                            {index + 1}. {centre.name}
                          </Typography>
                          <Typography sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                            {centre.phone && centre.phone !== 'N/A'
                              ? `Call: ${centre.phone}`
                              : 'Tap to preview route and details'}
                          </Typography>
                        </Box>
                        <Chip
                          label={`${centre.distance_km} km`}
                          sx={{
                            borderRadius: '999px',
                            bgcolor: alpha('#ff6b4a', 0.12),
                            color: '#b3452f',
                            fontWeight: 700,
                          }}
                        />
                      </Stack>
                    </Box>
                  )
                })
              ) : (
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: '22px',
                    bgcolor: alpha('#182433', 0.04),
                    color: 'text.secondary',
                    lineHeight: 1.8,
                  }}
                >
                  Use your location to load the nearest repair centres and route preview.
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: '28px',
              border: `1px solid ${alpha('#182433', 0.08)}`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,249,0.92))',
            }}
          >
            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
              <Typography variant="h5">Selected centre</Typography>
              {detailLoading && <CircularProgress size={18} />}
            </Stack>

            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 2 }}>
              {selectedCentre
                ? 'Review the selected service-centre details before opening navigation for repair.'
                : 'Select a nearby service centre to load route and repair information.'}
            </Typography>

            {selectedCentre ? (
              <>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '22px',
                    bgcolor: alpha('#182433', 0.04),
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 0.4 }}>
                    {selectedCentre.name}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary' }}>
                    Approx. {selectedCentre.distance_km} km from your current location
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1.4}>
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.45 }}>
                      <PlaceRoundedIcon fontSize="small" sx={{ color: '#1d8f7a' }} />
                      <Typography sx={{ fontWeight: 700 }}>Address</Typography>
                    </Stack>
                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      {detailValue(details?.address)}
                    </Typography>
                  </Box>

                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.45 }}>
                      <CallRoundedIcon fontSize="small" sx={{ color: '#1d8f7a' }} />
                      <Typography sx={{ fontWeight: 700 }}>Phone</Typography>
                    </Stack>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {detailValue(details?.phone, selectedCentre.phone || 'Not available yet')}
                    </Typography>
                  </Box>

                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.45 }}>
                      <ScheduleRoundedIcon fontSize="small" sx={{ color: '#1d8f7a' }} />
                      <Typography sx={{ fontWeight: 700 }}>Opening hours</Typography>
                    </Stack>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {detailValue(details?.opening_hours)}
                    </Typography>
                  </Box>

                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.45 }}>
                      <LanguageRoundedIcon fontSize="small" sx={{ color: '#1d8f7a' }} />
                      <Typography sx={{ fontWeight: 700 }}>Website</Typography>
                    </Stack>
                    {details?.website && details.website !== 'N/A' ? (
                      <Link
                        href={details.website}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        sx={{ color: '#14695a', fontWeight: 700 }}
                      >
                        {details.website}
                      </Link>
                    ) : (
                      <Typography sx={{ color: 'text.secondary' }}>Not available yet</Typography>
                    )}
                  </Box>

                  <Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.45 }}>
                      <StarRoundedIcon fontSize="small" sx={{ color: '#1d8f7a' }} />
                      <Typography sx={{ fontWeight: 700 }}>Rating</Typography>
                    </Stack>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {detailValue(details?.rating)}
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<DirectionsRoundedIcon />}
                  onClick={() => openDirections(selectedCentre)}
                  sx={{ borderRadius: '16px', alignSelf: 'flex-start' }}
                >
                  Open in Google Maps
                </Button>
              </>
            ) : (
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: '22px',
                  bgcolor: alpha('#182433', 0.04),
                  color: 'text.secondary',
                  lineHeight: 1.8,
                }}
              >
                After the nearby search runs, this panel displays the selected repair
                centre and its supporting details.
              </Box>
            )}
          </Paper>
        </Stack>
      </Box>
    </Box>
  )
}
