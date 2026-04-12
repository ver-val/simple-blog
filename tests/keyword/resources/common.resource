*** Settings ***
Library    SeleniumLibrary

*** Variables ***
${BASE_URL}         http://localhost:5173
${BROWSER}          chrome
${SELENIUM_DELAY}   0.2s

*** Keywords ***
Open Browser To Blog
    Open Browser    ${BASE_URL}    ${BROWSER}
    Set Selenium Speed    ${SELENIUM_DELAY}
    Maximize Browser Window

Close Browser Session
    Close Browser

Open Public Page
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}

Page Should Show Heading
    [Arguments]    ${heading}
    Wait Until Page Contains Element    xpath=//h1[normalize-space()='${heading}']    10s

Input Text By Placeholder
    [Arguments]    ${placeholder}    ${value}
    Input Text    css:input[placeholder="${placeholder}"]    ${value}

Submit Button Should Be Disabled
    Wait Until Page Contains Element    css:button[disabled]    10s

Page Should Contain Error
    [Arguments]    ${message}
    Wait Until Page Contains    ${message}    10s

Page Should Have Element
    [Arguments]    ${locator}
    Wait Until Page Contains Element    ${locator}    10s
