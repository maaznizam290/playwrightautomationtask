import { expect, test, type Locator, type Page } from '@playwright/test';

const BASE_URL = process.env.SAUCE_URL ?? 'https://www.saucedemo.com/';
const USERNAME = process.env.SAUCE_USERNAME ?? 'standard_user';
const PASSWORD = process.env.SAUCE_PASSWORD ?? 'secret_sauce';

const PRODUCT_NAME = 'Sauce Labs Backpack';
const CUSTOMER = {
  firstName: 'QA',
  lastName: 'Automation',
  postalCode: '10001',
} as const;

/** Returns the product card containing the exact product name. */
function productCard(page: Page, productName: string): Locator {
  return page.getByTestId('inventory-item').filter({ hasText: productName });
}

/**
 * Parses a displayed USD amount into integer cents.
 * Integer arithmetic avoids floating-point rounding in price comparisons.
 */
function parseUsdToCents(label: string, context: string): number {
  const match = label.match(/\$\s*(\d+(?:,\d{3})*)(?:\.(\d{2}))?(?![\d.])/);

  if (!match) {
    throw new Error(`${context}: expected a USD amount in "${label}"`);
  }

  const wholeDollars = Number(match[1].replace(/,/g, ''));
  const cents = Number(match[2] ?? '00');

  if (!Number.isSafeInteger(wholeDollars) || !Number.isSafeInteger(cents)) {
    throw new Error(`${context}: invalid USD amount in "${label}"`);
  }

  return wholeDollars * 100 + cents;
}

/** Uses a retrying visibility assertion before reading the displayed amount. */
async function readPriceInCents(locator: Locator, context: string): Promise<number> {
  await expect(locator, `${context} should be visible`).toBeVisible();
  return parseUsdToCents(await locator.innerText(), context);
}

test.describe('SauceDemo checkout', () => {
  test('standard user can purchase a backpack and receive a consistent order confirmation', async ({ page }) => {
    let inventoryPriceCents = 0;

    await test.step('Log in and verify the inventory page', async () => {
      await page.goto(BASE_URL);

      const usernameInput = page.getByTestId('username');
      const passwordInput = page.getByTestId('password');
      const loginButton = page.getByTestId('login-button');

      // Web-first assertions retry until the UI reaches the expected state.
      await expect(usernameInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(loginButton).toBeEnabled();

      await usernameInput.fill(USERNAME);
      await passwordInput.fill(PASSWORD);
      await loginButton.click();

      await expect(page).toHaveURL(/\/inventory\.html\/?$/);
      await expect(page.getByTestId('title')).toHaveText('Products');

      const backpack = productCard(page, PRODUCT_NAME);
      await expect(backpack, 'The backpack should appear exactly once in inventory').toHaveCount(1);
      await expect(backpack).toBeVisible();

      inventoryPriceCents = await readPriceInCents(
        backpack.getByTestId('inventory-item-price'),
        'Inventory backpack price',
      );
    });

    await test.step('Add the backpack and verify cart contents', async () => {
      const backpack = productCard(page, PRODUCT_NAME);
      const addToCartButton = backpack.getByRole('button', { name: 'Add to cart' });

      await expect(addToCartButton).toBeVisible();
      await expect(addToCartButton).toBeEnabled();
      await addToCartButton.click();

      // The cart badge and changed button state confirm the action took effect.
      await expect(backpack.getByRole('button', { name: 'Remove' })).toBeVisible();
      await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');

      await page.getByTestId('shopping-cart-link').click();
      await expect(page).toHaveURL(/\/cart\.html\/?$/);

      const cartItems = page.getByTestId('inventory-item');
      await expect(cartItems).toHaveCount(1);

      const cartBackpack = productCard(page, PRODUCT_NAME);
      await expect(cartBackpack).toHaveCount(1);
      await expect(cartBackpack.getByTestId('inventory-item-name')).toHaveText(PRODUCT_NAME);
      await expect(cartBackpack.getByTestId('item-quantity')).toHaveText('1');

      const cartPriceCents = await readPriceInCents(
        cartBackpack.getByTestId('inventory-item-price'),
        'Cart backpack price',
      );
      expect(cartPriceCents, 'The cart price should match the inventory price').toBe(inventoryPriceCents);

      const checkoutButton = page.getByTestId('checkout');
      await expect(checkoutButton).toBeEnabled();
      await checkoutButton.click();
    });

    await test.step('Submit checkout details and validate the order overview', async () => {
      await expect(page).toHaveURL(/\/checkout-step-one\.html\/?$/);
      await expect(page.getByTestId('title')).toHaveText('Checkout: Your Information');

      const firstNameInput = page.getByTestId('firstName');
      const lastNameInput = page.getByTestId('lastName');
      const postalCodeInput = page.getByTestId('postalCode');
      const continueButton = page.getByTestId('continue');

      await expect(firstNameInput).toBeVisible();
      await expect(lastNameInput).toBeVisible();
      await expect(postalCodeInput).toBeVisible();

      await firstNameInput.fill(CUSTOMER.firstName);
      await lastNameInput.fill(CUSTOMER.lastName);
      await postalCodeInput.fill(CUSTOMER.postalCode);

      // Verify form state before submitting, so a failed fill is easier to diagnose.
      await expect(firstNameInput).toHaveValue(CUSTOMER.firstName);
      await expect(lastNameInput).toHaveValue(CUSTOMER.lastName);
      await expect(postalCodeInput).toHaveValue(CUSTOMER.postalCode);
      await expect(continueButton).toBeEnabled();
      await continueButton.click();

      await expect(page).toHaveURL(/\/checkout-step-two\.html\/?$/);
      await expect(page.getByTestId('title')).toHaveText('Checkout: Overview');

      const overviewBackpack = productCard(page, PRODUCT_NAME);
      await expect(overviewBackpack).toHaveCount(1);
      await expect(overviewBackpack.getByTestId('item-quantity')).toHaveText('1');

      const summaryPriceCents = await readPriceInCents(
        overviewBackpack.getByTestId('inventory-item-price'),
        'Checkout summary backpack price',
      );
      const subtotalCents = await readPriceInCents(page.getByTestId('subtotal-label'), 'Checkout subtotal');
      const taxCents = await readPriceInCents(page.getByTestId('tax-label'), 'Checkout tax');
      const totalCents = await readPriceInCents(page.getByTestId('total-label'), 'Checkout total');

      // Business rules for a single-item order: item price = subtotal; total = subtotal + tax.
      expect(summaryPriceCents, 'The summary price should match the inventory price').toBe(inventoryPriceCents);
      expect(subtotalCents, 'A one-item order subtotal should equal the item price').toBe(summaryPriceCents);
      expect(taxCents, 'Tax should not be negative').toBeGreaterThanOrEqual(0);
      expect(totalCents, 'Order total should equal subtotal plus tax').toBe(subtotalCents + taxCents);
    });

    await test.step('Finish checkout and verify successful completion', async () => {
      const finishButton = page.getByTestId('finish');
      await expect(finishButton).toBeVisible();
      await expect(finishButton).toBeEnabled();
      await finishButton.click();

      await expect(page).toHaveURL(/\/checkout-complete\.html\/?$/);
      await expect(page.getByTestId('complete-header')).toHaveText('Thank you for your order!');
      await expect(page.getByTestId('complete-text')).toContainText('Your order has been dispatched');
      await expect(page.getByTestId('back-to-products')).toBeVisible();
      await expect(page.getByTestId('shopping-cart-badge')).toBeHidden();
    });
  });
});
