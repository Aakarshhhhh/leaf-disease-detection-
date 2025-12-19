import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { connectDatabase, checkDatabaseHealth } from './lib/database.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth()
  
  res.json({ 
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'leaf-disease-detection-backend',
    database: dbHealthy ? 'connected' : 'disconnected'
  })
})

// Placeholder API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Leaf Disease Detection API' })
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Initialize database connection and start server
async function startServer() {
  try {
    await connectDatabase()
    
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  const { disconnectDatabase } = await import('./lib/database.js')
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  const { disconnectDatabase } = await import('./lib/database.js')
  await disconnectDatabase()
  process.exit(0)
})

startServer()