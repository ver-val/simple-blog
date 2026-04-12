import assert from "node:assert/strict";
import { After, Given, When, Then } from "@cucumber/cucumber";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { BasePage } from "../../../selenium/pages/base-page.js";
import { RegisterPage } from "../../../selenium/pages/register-page.js";
import { LoginPage } from "../../../selenium/pages/login-page.js";
import { ForgotPasswordPage } from "../../../selenium/pages/forgot-password-page.js";

async function ensureDriver(world) {
  if (world.driver) {
    return;
  }

  const options = new chrome.Options();
  options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,1200");

  world.baseUrl = world.baseUrl || process.env.CUCUMBER_BASE_URL || "http://127.0.0.1:5173";
  world.driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  world.runDir = await BasePage.createRunDir();
}

Given("I open the register page", async function () {
  await ensureDriver(this);
  this.page = new RegisterPage(this.driver, this.runDir);
  await this.page.open(this.baseUrl);
});

When("I fill the register form with an invalid email", async function () {
  await this.page.fillForm({
    username: "cucumber.user",
    email: "invalid-email",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
});

When("I submit the register form", async function () {
  await this.page.submit();
});

Then("I should see the register error {string}", async function (message) {
  const error = await this.page.readError();
  assert.equal(error, message);
});

Given("I open the login page", async function () {
  await ensureDriver(this);
  this.page = new LoginPage(this.driver, this.runDir);
  await this.page.open(this.baseUrl);
});

Then("the login submit button should be disabled", async function () {
  const disabled = await this.page.isSubmitDisabled();
  assert.equal(disabled, true);
});

Given("I open the reset password page without a token", async function () {
  await ensureDriver(this);
  this.page = new ForgotPasswordPage(this.driver, this.runDir);
  await this.driver.get(`${this.baseUrl}/reset-password`);
});

Then("I should be redirected to the forgot password page", async function () {
  await this.page.waitForRoute("/forgot-password");
  const heading = await this.page.heading();
  assert.equal(heading, "Forgot Password");
});

Then("I should see the forgot password error {string}", async function (message) {
  const error = await this.page.readError();
  assert.equal(error, message);
});

Given("I open the forgot password page", async function () {
  await ensureDriver(this);
  this.page = new ForgotPasswordPage(this.driver, this.runDir);
  await this.page.open(this.baseUrl);
});

Then("I should see the forgot password form controls", async function () {
  assert.equal(await this.page.hasEmailInput(), true);
  assert.equal(await this.page.hasSubmitButton(), true);
});

After(async function () {
  if (this.driver) {
    await this.driver.quit();
    this.driver = null;
  }
});
