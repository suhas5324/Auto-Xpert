import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, styled } from '@mui/material/styles'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PhotoCameraBackRoundedIcon from '@mui/icons-material/PhotoCameraBackRounded'
import RadarRoundedIcon from '@mui/icons-material/RadarRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { buildApiUrl } from './config'

const DamageUploadInput = styled('input')({
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
})

const DAMAGE_COLORS = ['#ff6b4a', '#1d8f7a', '#d99029', '#3c70b6', '#b04cc2', '#404b5a']
const severityPriority = { severe: 3, moderate: 2, mild: 1 }

function formatLabel(value, fallback) {
  if (!value) {
    return fallback
  }

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getSeverityColor(severity) {
  switch (String(severity).toLowerCase()) {
    case 'severe':
      return '#d94841'
    case 'moderate':
      return '#d98924'
    case 'mild':
      return '#2f7d62'
    default:
      return '#5a6d83'
  }
}

function getHighestSeverity(boxes) {
  if (!boxes.length) {
    return 'Pending'
  }

  return boxes
    .map((box) => String(box.severity || '').toLowerCase())
    .sort((left, right) => (severityPriority[right] || 0) - (severityPriority[left] || 0))[0]
}

export default function DamageViewer() {
  const [imgUrl, setImgUrl] = useState(null)
  const [boxes, setBoxes] = useState([])
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copyMessage, setCopyMessage] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedDamageIndex, setSelectedDamageIndex] = useState(null)
  const [fileName, setFileName] = useState('')
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const severeCount = boxes.filter((box) => String(box.severity).toLowerCase() === 'severe').length
  const moderateCount = boxes.filter((box) => String(box.severity).toLowerCase() === 'moderate').length
  const highestSeverity = formatLabel(getHighestSeverity(boxes), 'Pending')
  const selectedDamage = selectedDamageIndex !== null ? boxes[selectedDamageIndex] : null

  const generateDamageSummary = () => {
    if (!boxes.length) {
      return 'No visible damage regions were returned for this image. Try a higher-quality photo or a tighter crop if the vehicle damage is subtle.'
    }

    const damageDescriptions = boxes
      .map((box, index) => {
        const part = formatLabel(box.part || box.cls, 'Unknown Part')
        const damageType = formatLabel(box.damage_type, 'Unknown Damage Type')
        const severity = formatLabel(box.severity, 'Unknown Severity')

        return `${index + 1}. ${part}: ${damageType} with ${severity.toLowerCase()} severity`
      })
      .join('; ')

    return `Vehicle damage assessment summary: ${boxes.length} issue(s) detected. ${damageDescriptions}. Use this summary for repair discussion, chatbot guidance, or claim documentation.`
  }

  const handleClearImage = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setImgUrl(null)
    setBoxes([])
    setError(null)
    setSelectedDamageIndex(null)
    setFileName('')
    setHasAnalyzed(false)
    setImageSize({ width: 0, height: 0 })

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const setPreviewFromFile = (file) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setImgUrl(previewUrl)
    setFileName(file.name)
  }

  const uploadForPrediction = async (file) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      setBoxes([])
      setSelectedDamageIndex(null)
      setHasAnalyzed(false)
      setPreviewFromFile(file)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(buildApiUrl('/predict'), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process the image.')
      }

      const data = await response.json()
      const predictions = Array.isArray(data.predictions) ? data.predictions : []

      setBoxes(predictions)
      setSelectedDamageIndex(predictions.length ? 0 : null)
      setHasAnalyzed(true)
    } catch (requestError) {
      setError(requestError.message || 'Unable to analyze the image right now.')
    } finally {
      setIsLoading(false)
      setDragActive(false)
    }
  }

  const handleInputChange = (event) => {
    uploadForPrediction(event.target.files?.[0])
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    uploadForPrediction(event.dataTransfer.files?.[0])
  }

  const onImageLoad = (event) => {
    setImageSize({
      width: event.target.naturalWidth,
      height: event.target.naturalHeight,
    })
  }

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(generateDamageSummary())
      setCopyMessage(true)
    } catch {
      setError('Copy failed. Your browser may not allow clipboard access in this context.')
    }
  }

  const openChatbot = () => {
    window.open(
      'https://partyrock.aws/u/suhas5324/LwT17c71g/DamageDollar',
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
            AI damage detection and vehicle assessment
          </Typography>
          <Typography sx={{ maxWidth: 760, color: 'text.secondary', lineHeight: 1.8 }}>
            Upload a vehicle image to detect damaged regions, inspect severity levels,
            and generate a structured project summary.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            icon={<VerifiedRoundedIcon />}
            label="Annotated image preview"
            sx={{
              borderRadius: '999px',
              bgcolor: alpha('#1d8f7a', 0.12),
              color: '#14695a',
              fontWeight: 700,
            }}
          />
          <Chip
            icon={<AutoAwesomeRoundedIcon />}
            label="Claim-ready summary"
            sx={{
              borderRadius: '999px',
              bgcolor: alpha('#ff6b4a', 0.12),
              color: '#b3452f',
              fontWeight: 700,
            }}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.2fr 0.8fr' },
          gap: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '30px',
            border: `1px solid ${alpha('#182433', 0.08)}`,
            background: dragActive
              ? `linear-gradient(180deg, ${alpha('#1d8f7a', 0.14)}, rgba(255,255,255,0.94))`
              : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,249,247,0.92))',
            boxShadow: '0 24px 70px rgba(24, 36, 51, 0.08)',
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragActive(false)
          }}
          onDrop={handleDrop}
        >
          {isLoading && (
            <LinearProgress
              sx={{
                position: 'absolute',
                inset: '0 0 auto 0',
                height: 5,
              }}
            />
          )}

          {!imgUrl ? (
            <Box
              sx={{
                minHeight: 520,
                px: { xs: 3, md: 5 },
                py: { xs: 4, md: 5 },
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 760,
                  p: { xs: 3, md: 4 },
                  borderRadius: '28px',
                  border: `1.5px dashed ${alpha('#182433', 0.18)}`,
                  background: alpha('#ffffff', 0.76),
                  textAlign: 'center',
                }}
              >
                <Box
                  sx={{
                    width: 74,
                    height: 74,
                    mx: 'auto',
                    mb: 2.5,
                    borderRadius: '24px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha('#1d8f7a', 0.12),
                    color: '#14695a',
                  }}
                >
                  <PhotoCameraBackRoundedIcon sx={{ fontSize: 34 }} />
                </Box>

                <Typography variant="h4" sx={{ mb: 1.25, fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
                  Drop the car photo here
                </Typography>
                <Typography sx={{ color: 'text.secondary', maxWidth: 540, mx: 'auto', lineHeight: 1.8 }}>
                  Upload a vehicle image to begin the project workflow for part detection,
                  damage-type classification, and severity estimation.
                </Typography>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ justifyContent: 'center', mt: 3.5 }}
                >
                  <Button
                    component="label"
                    variant="contained"
                    size="large"
                    startIcon={<CloudUploadRoundedIcon />}
                    sx={{ borderRadius: '18px', px: 2.5, minHeight: 52 }}
                  >
                    Upload Vehicle Image
                    <DamageUploadInput
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleInputChange}
                    />
                  </Button>
                  <Chip
                    icon={<RadarRoundedIcon />}
                    label="Supports JPG, PNG, WEBP"
                    sx={{
                      height: 52,
                      borderRadius: '18px',
                      px: 1.5,
                      bgcolor: alpha('#182433', 0.06),
                    }}
                  />
                </Stack>

                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.25}
                  sx={{ justifyContent: 'center', mt: 3, flexWrap: 'wrap' }}
                >
                  {['Use close, well-lit photos', 'Capture the full panel', 'Review results interactively'].map(
                    (tip) => (
                      <Chip
                        key={tip}
                        label={tip}
                        sx={{
                          borderRadius: '999px',
                          bgcolor: alpha('#1d8f7a', 0.08),
                          color: '#22384f',
                        }}
                      />
                    ),
                  )}
                </Stack>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                spacing={1.5}
                sx={{ mb: 2.5 }}
              >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={fileName || 'Uploaded image'}
                    sx={{
                      borderRadius: '999px',
                      bgcolor: alpha('#182433', 0.06),
                      color: '#24364b',
                      maxWidth: '100%',
                    }}
                  />
                  {imageSize.width > 0 && (
                    <Chip
                      label={`${imageSize.width} x ${imageSize.height}`}
                      sx={{
                        borderRadius: '999px',
                        bgcolor: alpha('#1d8f7a', 0.08),
                        color: '#14695a',
                      }}
                    />
                  )}
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUploadRoundedIcon />}
                    sx={{ borderRadius: '16px' }}
                  >
                    Replace
                    <DamageUploadInput
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleInputChange}
                    />
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={handleClearImage}
                    sx={{ borderRadius: '16px' }}
                  >
                    Clear
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '26px',
                  background: 'linear-gradient(180deg, #e7ecea, #dde5e2)',
                  border: `1px solid ${alpha('#182433', 0.08)}`,
                }}
              >
                <img
                  src={imgUrl}
                  alt="Uploaded vehicle"
                  onLoad={onImageLoad}
                  style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                />

                <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {boxes.map((box, index) => {
                    if (!imageSize.width || !imageSize.height) {
                      return null
                    }

                    const left = `${(box.x1 / imageSize.width) * 100}%`
                    const top = `${(box.y1 / imageSize.height) * 100}%`
                    const width = `${((box.x2 - box.x1) / imageSize.width) * 100}%`
                    const height = `${((box.y2 - box.y1) / imageSize.height) * 100}%`
                    const isSelected = selectedDamageIndex === index
                    const accent = DAMAGE_COLORS[index % DAMAGE_COLORS.length]

                    return (
                      <Box
                        key={`${box.part || box.cls}-${index}`}
                        onClick={() => setSelectedDamageIndex(index)}
                        sx={{
                          position: 'absolute',
                          left,
                          top,
                          width,
                          height,
                          borderRadius: '16px',
                          border: `3px solid ${accent}`,
                          bgcolor: alpha(accent, isSelected ? 0.16 : 0.05),
                          boxShadow: isSelected
                            ? `0 0 0 5px ${alpha(accent, 0.22)}`
                            : `0 8px 24px ${alpha('#182433', 0.1)}`,
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          transition: 'transform 180ms ease, box-shadow 180ms ease',
                          transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            minWidth: 34,
                            height: 34,
                            px: 1,
                            borderRadius: '999px',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: accent,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                          }}
                        >
                          {index + 1}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>

                {!isLoading && hasAnalyzed && boxes.length === 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 'auto 18px 18px',
                      p: 2,
                      borderRadius: '18px',
                      bgcolor: alpha('#fffdf8', 0.92),
                      border: `1px solid ${alpha('#182433', 0.08)}`,
                      boxShadow: '0 18px 40px rgba(24, 36, 51, 0.12)',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, mb: 0.5 }}>No visible damage returned</Typography>
                    <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      Try a higher-resolution image or crop the damaged area more tightly
                      if the issue is subtle.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
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
            <Typography variant="h5" sx={{ mb: 1.75 }}>
              Assessment snapshot
            </Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 2.5 }}>
              Review the number of detected damages and the severity profile of the
              uploaded vehicle image at a glance.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1.5,
              }}
            >
              {[
                { label: 'Detected areas', value: String(boxes.length).padStart(2, '0') },
                { label: 'Highest severity', value: highestSeverity },
                { label: 'Severe issues', value: String(severeCount).padStart(2, '0') },
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
                      fontSize: { xs: '1.2rem', md: '1.35rem' },
                      fontWeight: 700,
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

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
              <Chip
                label={`${moderateCount} moderate`}
                sx={{ borderRadius: '999px', bgcolor: alpha('#d98924', 0.12), color: '#a16616' }}
              />
              <Chip
                label={`${Math.max(boxes.length - severeCount - moderateCount, 0)} mild`}
                sx={{ borderRadius: '999px', bgcolor: alpha('#1d8f7a', 0.12), color: '#14695a' }}
              />
            </Stack>
          </Paper>

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
              Detected damage list
            </Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 2.25 }}>
              Click any card to match the written finding with the highlighted box in the image.
            </Typography>

            <Stack spacing={1.2}>
              {boxes.length > 0 ? (
                boxes.map((box, index) => {
                  const accent = DAMAGE_COLORS[index % DAMAGE_COLORS.length]
                  const isSelected = selectedDamageIndex === index

                  return (
                    <Box
                      key={`${box.part || box.cls}-${index}`}
                      component="button"
                      type="button"
                      onClick={() => setSelectedDamageIndex(index)}
                      sx={{
                        width: '100%',
                        border: `1px solid ${isSelected ? alpha(accent, 0.4) : alpha('#182433', 0.08)}`,
                        borderLeft: `5px solid ${accent}`,
                        borderRadius: '20px',
                        bgcolor: isSelected ? alpha(accent, 0.08) : '#fff',
                        p: 2,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'transform 160ms ease, box-shadow 160ms ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 12px 30px rgba(24, 36, 51, 0.08)',
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography sx={{ fontWeight: 800, color: '#1c2838', mb: 0.4 }}>
                            {index + 1}. {formatLabel(box.part || box.cls, 'Unknown Part')}
                          </Typography>
                          <Typography sx={{ color: 'text.secondary' }}>
                            {formatLabel(box.damage_type, 'Unknown damage type')}
                          </Typography>
                        </Box>
                        <Chip
                          label={formatLabel(box.severity, 'Unknown')}
                          sx={{
                            borderRadius: '999px',
                            bgcolor: alpha(getSeverityColor(box.severity), 0.12),
                            color: getSeverityColor(box.severity),
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
                  Upload an image to populate the structured findings list. It will stay synced
                  with the annotated preview on the left.
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
            <Typography variant="h5" sx={{ mb: 0.8 }}>
              Repair summary
            </Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 2 }}>
              Use the generated summary as the project output for vehicle damage review and
              repair discussion.
            </Typography>

            {selectedDamage && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.75,
                  borderRadius: '18px',
                  bgcolor: alpha(getSeverityColor(selectedDamage.severity), 0.08),
                }}
              >
                <Typography sx={{ fontWeight: 800, mb: 0.4 }}>
                  Focus area: {formatLabel(selectedDamage.part || selectedDamage.cls, 'Unknown Part')}
                </Typography>
                <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                  {formatLabel(selectedDamage.damage_type, 'Unknown damage type')} with{' '}
                  <span style={{ color: getSeverityColor(selectedDamage.severity), fontWeight: 700 }}>
                    {formatLabel(selectedDamage.severity, 'unknown')}
                  </span>{' '}
                  severity.
                </Typography>
              </Box>
            )}

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '22px',
                border: `1px solid ${alpha('#182433', 0.08)}`,
                bgcolor: alpha('#ffffff', 0.92),
              }}
            >
              <Typography sx={{ color: '#24364b', lineHeight: 1.85 }}>
                {generateDamageSummary()}
              </Typography>
            </Paper>

            <Divider sx={{ my: 2 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="contained"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={handleCopySummary}
                sx={{ borderRadius: '16px' }}
              >
                Copy Summary
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<OpenInNewRoundedIcon />}
                onClick={openChatbot}
                sx={{ borderRadius: '16px' }}
              >
                Ask Repair Assistant
              </Button>
            </Stack>

            {error && (
              <Alert
                severity="error"
                icon={<WarningAmberRoundedIcon />}
                sx={{ mt: 2, borderRadius: '18px' }}
              >
                {error}
              </Alert>
            )}
          </Paper>
        </Stack>
      </Box>

      <Snackbar
        open={copyMessage}
        autoHideDuration={2800}
        onClose={() => setCopyMessage(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setCopyMessage(false)}
          sx={{ width: '100%', borderRadius: '14px' }}
        >
          Summary copied to clipboard.
        </Alert>
      </Snackbar>
    </Box>
  )
}
