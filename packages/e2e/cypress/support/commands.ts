/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      uploadImage(fileName: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type(email)
  cy.get('[data-testid="password-input"]').type(password)
  cy.get('[data-testid="login-button"]').click()
  cy.url().should('not.include', '/login')
})

Cypress.Commands.add('uploadImage', (fileName: string) => {
  cy.fixture(fileName).then(fileContent => {
    cy.get('[data-testid="file-upload"]').selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName,
      mimeType: 'image/jpeg'
    })
  })
})