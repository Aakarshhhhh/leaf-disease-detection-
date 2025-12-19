import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'
import App from './App'

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />)
    const heading = screen.getByText('Leaf Disease Detection System')
    expect(heading).toBeInTheDocument()
  })

  it('renders the placeholder text', () => {
    render(<App />)
    const placeholder = screen.getByText('Frontend application placeholder')
    expect(placeholder).toBeInTheDocument()
  })
})