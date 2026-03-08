import {
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material'
import { createTheme } from '@mui/material/styles'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import './App.css'
import DamageViewer from './DamageViewer.jsx'
import NearestServiceCenter from './NearestServiceCenter.jsx'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1d8f7a',
      dark: '#14695a',
      light: '#69c9b7',
    },
    secondary: {
      main: '#ff6b4a',
      dark: '#d44e32',
      light: '#ffb09c',
    },
    background: {
      default: '#f7f1e7',
      paper: '#fffdf8',
    },
    text: {
      primary: '#182433',
      secondary: '#56667b',
    },
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.05em',
    },
    h2: {
      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h3: {
      fontFamily: '"Space Grotesk", "Manrope", sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 22,
  },
})

const heroStats = [
  { value: '< 60 sec', label: 'Average assessment handoff' },
  { value: '3-step', label: 'Flow from photo to repair route' },
  { value: 'Claim-ready', label: 'Summary output you can reuse' },
]

const workflowSteps = [
  {
    icon: CameraAltRoundedIcon,
    eyebrow: 'Capture',
    title: 'Upload the damage photo',
    body: 'Upload a vehicle image to start part detection, damage classification, and severity analysis.',
  },
  {
    icon: AutoAwesomeRoundedIcon,
    eyebrow: 'Analyze',
    title: 'Review structured AI findings',
    body: 'Inspect detected parts, damage types, severity labels, and the generated assessment summary.',
  },
  {
    icon: MapRoundedIcon,
    eyebrow: 'Route',
    title: 'Move to the nearest repair option',
    body: 'Find nearby service centres, review location details, and open the repair route from the same page.',
  },
]

const experienceSignals = [
  {
    icon: ShieldRoundedIcon,
    title: 'Damage Detection',
    body: 'The project detects damaged vehicle parts and highlights them directly on the uploaded image.',
  },
  {
    icon: BoltRoundedIcon,
    title: 'Severity Analysis',
    body: 'Each detected region is paired with damage type and severity so the assessment is easier to review.',
  },
  {
    icon: LocalShippingRoundedIcon,
    title: 'Repair Support',
    body: 'The project also helps users locate nearby service centres and continue the repair process quickly.',
  },
]

function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="app-shell">
        <div className="background-orb orb-one" />
        <div className="background-orb orb-two" />
        <div className="background-grid" />

        <Container maxWidth="xl" className="app-container">
          <header className="topbar">
            <div className="brand-lockup">
              <div className="brand-mark">AX</div>
              <div>
                <p className="brand-kicker">Car Damage Intelligence</p>
                <h1 className="brand-name">AutoXpert</h1>
              </div>
            </div>

            <Stack direction="row" spacing={1.25} className="topbar-actions">
              <Button
                className="ghost-button"
                onClick={() => scrollToSection('damage-assessment')}
              >
                Damage Studio
              </Button>
              <Button
                variant="contained"
                className="topbar-cta"
                endIcon={<NorthEastRoundedIcon />}
                onClick={() => scrollToSection('service-routing')}
              >
                Repair Routing
              </Button>
            </Stack>
          </header>

          <main className="page-content">
            <section className="hero-grid">
              <div className="hero-copy">
                <Chip
                  className="eyebrow-chip"
                  label="AI based vehicle damage assessment"
                  color="secondary"
                />

                <Typography variant="h1" className="hero-title">
                  Detect vehicle damage and move toward repair faster.
                </Typography>

                <Typography className="hero-text">
                  AutoXpert is a car damage assessment project that combines image-based
                  damage detection, severity analysis, structured summaries, and nearby
                  service-centre discovery in one workflow.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="hero-actions">
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    className="hero-cta"
                    onClick={() => scrollToSection('damage-assessment')}
                  >
                    Start Damage Review
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    className="hero-secondary"
                    onClick={() => scrollToSection('service-routing')}
                  >
                    Explore Service Routing
                  </Button>
                </Stack>

                <div className="hero-stats">
                  {heroStats.map((stat) => (
                    <article key={stat.label} className="stat-card">
                      <p className="stat-value">{stat.value}</p>
                      <p className="stat-label">{stat.label}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="hero-visual">
                <article className="hero-panel hero-panel-primary">
                  <div className="signal-row">
                    <span className="signal-dot" />
                    Project workflow
                  </div>
                  <h2>Upload. Detect. Review. Repair.</h2>
                  <p>
                    The project guides users from vehicle image upload to damage review,
                    summary generation, and nearby repair support.
                  </p>

                  <div className="panel-progress">
                    <div>
                      <span>Photo ingestion</span>
                      <strong>Vehicle image</strong>
                    </div>
                    <div>
                      <span>Damage analysis</span>
                      <strong>AI detection</strong>
                    </div>
                    <div>
                      <span>Service routing</span>
                      <strong>Nearest centres</strong>
                    </div>
                  </div>
                </article>

                <article className="hero-panel hero-panel-floating top">
                  <p className="panel-tag">Detection</p>
                  <h3>Damage and severity review</h3>
                  <p>
                    Detected regions are marked on the image and paired with part, damage
                    type, and severity information.
                  </p>
                </article>

                <article className="hero-panel hero-panel-floating bottom">
                  <p className="panel-tag">Support</p>
                  <h3>Summary and service guidance</h3>
                  <p>
                    The project generates a reusable damage summary and helps users locate
                    nearby service centres for repair follow-up.
                  </p>
                </article>
              </div>
            </section>

            <section className="workflow-grid">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon

                return (
                  <article key={step.title} className="workflow-card">
                    <div className="workflow-topline">
                      <span className="workflow-index">{String(index + 1).padStart(2, '0')}</span>
                      <Icon className="workflow-icon" />
                    </div>
                    <p className="workflow-eyebrow">{step.eyebrow}</p>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </article>
                )
              })}
            </section>

            <section className="section-intro" id="damage-assessment">
              <div>
                <p className="section-kicker">Damage Studio</p>
                <h2>Review detected vehicle damage with structured AI results.</h2>
              </div>
              <p className="section-body">
                Upload a vehicle photo, inspect detected damage regions, and read the
                generated damage summary from one section.
              </p>
            </section>

            <section className="feature-panel">
              <DamageViewer />
            </section>

            <section className="section-intro" id="service-routing">
              <div>
                <p className="section-kicker">Repair Routing</p>
                <h2>Locate nearby service centres for the next repair step.</h2>
              </div>
              <p className="section-body">
                Use your current location to view nearby repair centres, route details,
                and key service information in one place.
              </p>
            </section>

            <section className="feature-panel">
              <NearestServiceCenter />
            </section>

            <section className="experience-grid">
              {experienceSignals.map((signal) => {
                const Icon = signal.icon

                return (
                  <article key={signal.title} className="experience-card">
                    <Icon className="experience-icon" />
                    <h3>{signal.title}</h3>
                    <p>{signal.body}</p>
                  </article>
                )
              })}
            </section>

            <section className="closing-banner">
              <div>
                <p className="section-kicker">Project Overview</p>
                <h2>AutoXpert connects damage detection, assessment, and repair discovery.</h2>
              </div>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  color="secondary"
                  className="hero-cta"
                  onClick={() => scrollToSection('damage-assessment')}
                >
                  View Damage Assessment
                </Button>
                <Button
                  variant="outlined"
                  className="hero-secondary"
                  onClick={() => scrollToSection('service-routing')}
                >
                  View Service Centres
                </Button>
              </Stack>
            </section>
          </main>
        </Container>
      </div>
    </ThemeProvider>
  )
}

export default App
