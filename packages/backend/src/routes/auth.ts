import express from 'express'
import { AuthService } from '../services/authService.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js'
import { validateRequest, registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from '../utils/validation.js'
import { DatabaseError } from '../types/index.js'

const router = express.Router()

// Register endpoint
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  try {
    const result = await AuthService.registerUser(req.body)
    
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    })
  } catch (error) {
    if (error instanceof DatabaseError) {
      return res.status(400).json({ error: error.message })
    }
    
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Login endpoint
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const result = await AuthService.loginUser(req.body)
    
    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    })
  } catch (error) {
    if (error instanceof DatabaseError) {
      return res.status(401).json({ error: error.message })
    }
    
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const user = await AuthService.getUserById(req.user.id)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    res.json({ user })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update user profile
router.put('/profile', authenticateToken, validateRequest(updateProfileSchema), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const updatedUser = await AuthService.updateUserProfile(req.user.id, req.body)
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })
  } catch (error) {
    if (error instanceof DatabaseError) {
      return res.status(400).json({ error: error.message })
    }
    
    console.error('Update profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Change password
router.post('/change-password', authenticateToken, validateRequest(changePasswordSchema), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    await AuthService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)
    
    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    if (error instanceof DatabaseError) {
      return res.status(400).json({ error: error.message })
    }
    
    console.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Logout endpoint (client-side token removal, but we can log it)
router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  // In a JWT-based system, logout is typically handled client-side by removing the token
  // We can log the logout event here for audit purposes
  console.log(`User ${req.user?.id} logged out at ${new Date().toISOString()}`)
  
  res.json({ message: 'Logout successful' })
})

export default router