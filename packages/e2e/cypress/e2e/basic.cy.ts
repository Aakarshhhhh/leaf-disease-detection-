describe('Basic Application Tests', () => {
  it('should load the homepage', () => {
    cy.visit('/')
    cy.contains('Leaf Disease Detection System')
    cy.contains('Frontend application placeholder')
  })

  it('should have correct page title', () => {
    cy.visit('/')
    cy.title().should('eq', 'Leaf Disease Detection')
  })
})