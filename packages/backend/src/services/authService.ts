import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { User, CreateUserInput, DatabaseError } from '../types/index.js'
import { generateToken } from '../middleware/auth.js'

const prisma = new PrismaClient()

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>
  token: string
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static async registerUser(userData: CreateUserInput): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        throw new DatabaseError('User with this email already exists')
      }

      // Hash password
      const passwordHash = await this.hashPassword(userData.password)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role || 'user'
        }
      })

      // Generate token
      const token = generateToken(user)

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user
      
      return {
        user: userWithoutPassword,
        token
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      console.error('Registration error:', error)
      throw new DatabaseError('Failed to create user')
    }
  }

  static async loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      })

      if (!user) {
        throw new DatabaseError('Invalid email or password')
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash)
      
      if (!isValidPassword) {
        throw new DatabaseError('Invalid email or password')
      }

      // Generate token
      const token = generateToken(user)

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user

      return {
        user: userWithoutPassword,
        token
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      console.error('Login error:', error)
      throw new DatabaseError('Login failed')
    }
  }

  static async getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return null
      }

      const { passwordHash: _, ...userWithoutPassword } = user
      return userWithoutPassword
    } catch (error) {
      console.error('Get user error:', error)
      throw new DatabaseError('Failed to retrieve user')
    }
  }

  static async updateUserProfile(
    userId: string, 
    updates: Partial<Pick<User, 'firstName' | 'lastName' | 'email'>>
  ): Promise<Omit<User, 'passwordHash'>> {
    try {
      // If email is being updated, check if it's already taken
      if (updates.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: updates.email,
            NOT: { id: userId }
          }
        })

        if (existingUser) {
          throw new DatabaseError('Email already in use')
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updates
      })

      const { passwordHash: _, ...userWithoutPassword } = user
      return userWithoutPassword
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      console.error('Update profile error:', error)
      throw new DatabaseError('Failed to update profile')
    }
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        throw new DatabaseError('User not found')
      }

      // Verify current password
      const isValidPassword = await this.verifyPassword(currentPassword, user.passwordHash)
      
      if (!isValidPassword) {
        throw new DatabaseError('Current password is incorrect')
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword)

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      })
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      console.error('Change password error:', error)
      throw new DatabaseError('Failed to change password')
    }
  }
}