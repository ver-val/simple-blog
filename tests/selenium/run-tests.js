import assert from "node:assert/strict";
import process from "node:process";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { BasePage } from "./pages/base-page.js";
import { RegisterPage } from "./pages/register-page.js";
import { LoginPage } from "./pages/login-page.js";
import { ForgotPasswordPage } from "./pages/forgot-password-page.js";

const baseUrl = process.env.SELENIUM_BASE_URL || "http://127.0.0.1:5173";

async function waitForFrontend(url) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Frontend did not start in time at ${url}`);
}

async function withDriver(runDir, fn) {
  const options = new chrome.Options();
  options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1200");

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  try {
    await fn(driver);
  } finally {
    await driver.quit();
  }
}

async function testRegisterValidation(driver, runDir) {
  const page = new RegisterPage(driver, runDir);
  await page.open(baseUrl);
  await page.screenshot("register-open");
  await page.fillForm({
    username: "selenium.user",
    email: "invalid-email",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
  await page.screenshot("register-filled");
  await page.submit();
  await page.screenshot("register-submitted");
  const error = await page.readError();
  assert.equal(error, "The email address is not valid");
}

async function testLoginDisabled(driver, runDir) {
  const page = new LoginPage(driver, runDir);
  await page.open(baseUrl);
  await page.screenshot("login-open");
  const heading = await page.heading();
  assert.equal(heading, "Login");
  const disabled = await page.isSubmitDisabled();
  assert.equal(disabled, true);
  await page.mockJsonResponse("/auth/login", {
    status: 401,
    body: { error: "Invalid username/password, Try again!" },
  });
  await page.fillForm({
    username: "selenium.user",
    password: "Password123!",
  });
  await page.screenshot("login-filled");
  const enabled = await page.isSubmitEnabled();
  assert.equal(enabled, true);
  await page.submit();
  const error = await page.readError();
  await page.screenshot("login-submitted");
  assert.equal(error, "Invalid username/password, Try again!");
}

async function testResetRedirect(driver, runDir) {
  const page = new ForgotPasswordPage(driver, runDir);
  await driver.get(`${baseUrl}/reset-password`);
  await page.waitForRoute("/forgot-password");
  const heading = await page.heading();
  assert.equal(heading, "Forgot Password");
  const error = await page.readError();
  await page.screenshot("reset-redirected");
  assert.equal(error, "Password reset token is invalid or has expired.");
}

async function testForgotPasswordControls(driver, runDir) {
  const page = new ForgotPasswordPage(driver, runDir);
  await page.open(baseUrl);
  const heading = await page.heading();
  assert.equal(heading, "Forgot Password");
  assert.equal(await page.hasEmailInput(), true);
  assert.equal(await page.hasSubmitButton(), true);
  await page.screenshot("forgot-controls");
}

async function main() {
  const runDir = await BasePage.createRunDir();
  await waitForFrontend(baseUrl);
  await withDriver(runDir, async (driver) => {
    await testRegisterValidation(driver, runDir);
    await testLoginDisabled(driver, runDir);
    await testResetRedirect(driver, runDir);
    await testForgotPasswordControls(driver, runDir);
  });
  console.log(`Selenium WebDriver tests passed. Screenshots: ${runDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
