# SauceDemo End-to-End Automation — Playwright + TypeScript

This project automates one important business journey on [SauceDemo](https://www.saucedemo.com/):

**Login → Select product → Add to cart → Checkout → Verify successful completion**

## What the test verifies

1. `standard_user` can log in and reach the Products page.
2. The expected inventory is visible and the Sauce Labs Backpack is present exactly once.
3. Adding the backpack updates the cart badge and changes the product action to Remove.
4. The cart contains exactly one backpack with quantity 1.
5. The item remains the same in checkout and its price matches the value read on the inventory page.
6. The displayed subtotal matches the selected item price, and the total equals subtotal plus tax.
7. Finishing checkout displays the order-completion confirmation.

The test asserts outcomes rather than treating successful clicks as proof. It uses Playwright web-first assertions and auto-waiting; there are no fixed `waitForTimeout` sleeps.

## Requirements

- Node.js 20 or later
- npm
- Internet access to `https://www.saucedemo.com/`

## Install and run

From the project directory:

```bash
npm install
npx playwright install chromium
npm test
```

Run with a visible browser:

```bash
npm run test:headed
```

Run Playwright's interactive test UI:

```bash
npm run test:ui
```

Open the HTML report after a run:

```bash
npm run report
```

If a test fails, Playwright retains a screenshot and video; a trace is collected on the first retry in CI. Artifacts are written under `test-results/` and `playwright-report/`.

## Credentials and configuration

The test uses SauceDemo's public training credentials by default: `standard_user` / `secret_sauce`. They can be overridden with environment variables.

**PowerShell**

```powershell
$env:SAUCE_USERNAME = "standard_user"
$env:SAUCE_PASSWORD = "secret_sauce"
npm test
```

**macOS/Linux**

```bash
SAUCE_USERNAME=standard_user SAUCE_PASSWORD=secret_sauce npm test
```

Set `BASE_URL` to point to a different compatible test environment. Do not put private credentials or tokens in source control.

## Project structure

```text
.
├── .github/workflows/playwright.yml  # CI workflow
├── docs/ai-usage-review.md           # AI contribution and human review
├── tests/checkout.spec.ts            # End-to-end test
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── README.md
```

## Key design choices

- **Selectors:** Playwright's `getByTestId()` is configured to use SauceDemo's `data-test` attributes. These are generally less sensitive to layout changes than long CSS/XPath chains.
- **Assertions:** Checks inventory, cart state, product identity, item quantity, item price, subtotal, arithmetic, and final confirmation.
- **Money calculations:** Amounts are converted to integer cents before comparison to avoid floating-point rounding issues.
- **Isolation:** Playwright creates a fresh browser context for each test by default, avoiding cookies or browser storage leaking between tests.
- **Wait strategy:** Locator actions and web-first assertions use Playwright's auto-waiting rather than fixed delays.
- **Diagnostics:** HTML report, screenshot/video on failure, and CI retry trace support investigation.

## AI contribution and validation

See [`docs/ai-usage-review.md`](docs/ai-usage-review.md) for the prompts/assistance used, what was reviewed manually, and the limits of this test. The [`docs/workflow.md`](docs/workflow.md) file shows the journey and assertion decision points.

## Limitations

- This is a single happy-path UI test, not a complete regression suite.
- It depends on the public SauceDemo environment and its current selectors and product data.
- The item count and selected product price are specific to the current demo catalog; a deliberate catalog change may require updating expectations.
- The test does not validate backend persistence, real payment processing, API behavior, accessibility, all negative cases, or multiple browsers.
- A green result proves only that this particular journey passed in the recorded environment. Run it locally before submitting and report the real result; do not state that it passed unless you executed it.

## CI

A GitHub Actions workflow runs the test on pushes and pull requests and uploads the Playwright report and test results as artifacts.

## Publish to GitHub

Create a **public** repository on GitHub, then run these commands from this folder. After running `npm install`, commit the generated `package-lock.json` as well so future installs can be reproduced. Replace the URL with the actual repository URL you created:

```bash
git init
git add .
git commit -m "Add SauceDemo Playwright end-to-end test"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

After publishing, open the repository's Actions tab and confirm the workflow ran. Put the real repository URL in your assessment PDF; do not submit the placeholder URL.
