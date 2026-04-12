Feature: Public pages
  As a guest user
  I want to use public authentication pages
  So that I can recover my account or validate forms

  Scenario: Register page shows validation error for invalid email
    Given I open the register page
    When I fill the register form with an invalid email
    And I submit the register form
    Then I should see the register error "The email address is not valid"

  Scenario: Login page has disabled submit button by default
    Given I open the login page
    Then the login submit button should be disabled

  Scenario: Reset password without token redirects to forgot password
    Given I open the reset password page without a token
    Then I should be redirected to the forgot password page
    And I should see the forgot password error "Password reset token is invalid or has expired."

  Scenario: Forgot password page shows the required controls
    Given I open the forgot password page
    Then I should see the forgot password form controls
