*** Settings ***
Documentation    Keyword-driven UI tests for the public Simple Blog flows.
Resource         resources/common.resource
Suite Setup      Open Browser To Blog
Suite Teardown   Close Browser Session

*** Test Cases ***
Register Form Shows Validation Error For Invalid Email
    Open Public Page    /register
    Page Should Show Heading    Register
    Input Text By Placeholder    username    robot.user
    Input Text By Placeholder    email    invalid-email
    Input Text By Placeholder    password    Password123!
    Input Text By Placeholder    confirm password    Password123!
    Click Button    xpath=//button[normalize-space()='Register Now']
    Page Should Contain Error    The email address is not valid

Login Form Is Disabled By Default
    Open Public Page    /login
    Page Should Show Heading    Login
    Submit Button Should Be Disabled

Reset Password Without Token Redirects To Forgot Password
    Open Public Page    /reset-password
    Page Should Show Heading    Forgot Password
    Page Should Contain Error    Password reset token is invalid or has expired.

Forgot Password Page Shows Required Controls
    Open Public Page    /forgot-password
    Page Should Show Heading    Forgot Password
    Page Should Have Element    css:input[placeholder="Email"]
    Page Should Have Element    xpath=//button[normalize-space()='Submit']
