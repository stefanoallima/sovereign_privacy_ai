const { chromium } = require('playwright');

async function verify() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the dev server
    console.log('Loading app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Wait for the persona selector to load
    await page.waitForSelector('[data-tour="persona-selector"]', { timeout: 10000 });

    // Take a screenshot of the persona selector
    await page.screenshot({ path: 'persona_selector.png', fullPage: false });
    console.log('✅ Screenshot saved: persona_selector.png');

    // Check for badges
    const cybersecurityBadge = await page.$('text=🔐');
    const realEstateBadge = await page.$('text=🛡️');
    const warningBadge = await page.$('text=⚠️');

    console.log('');
    console.log('Badge detection:');
    if (cybersecurityBadge) {
      console.log('✅ Found 🔐 badge (Cybersecurity Advisor)');
    } else {
      console.log('❌ Missing 🔐 badge (Cybersecurity Advisor)');
    }

    if (realEstateBadge) {
      console.log('✅ Found 🛡️ badge (Real Estate/Immigration)');
    } else {
      console.log('❌ Missing 🛡️ badge (Real Estate/Immigration)');
    }

    if (warningBadge) {
      console.log('✅ Found ⚠️ badge (Personal Branding/Social Media)');
    } else {
      console.log('❌ Missing ⚠️ badge (Personal Branding/Social Media)');
    }

    // Click on Cybersecurity Advisor
    console.log('\nTesting Cybersecurity Advisor override warning...');
    const cybersecurityAdvisor = await page.$('text=Cybersecurity Advisor');
    if (cybersecurityAdvisor) {
      await cybersecurityAdvisor.click();
      await page.waitForTimeout(500);

      // Find and click the settings button
      const settingsButtons = await page.$$('button[title="Configure persona"]');
      if (settingsButtons.length > 0) {
        await settingsButtons[0].click();
        await page.waitForTimeout(1000);

        // Wait for config dialog
        await page.waitForSelector('text=Privacy', { timeout: 5000 });

        // Click Privacy tab
        await page.click('text=Privacy');
        await page.waitForTimeout(500);

        // Take screenshot of Privacy tab
        await page.screenshot({ path: 'privacy_tab.png', fullPage: true });
        console.log('✅ Privacy tab screenshot saved');

        // Try clicking Cloud mode
        const cloudButton = await page.$('text=Cloud (Nebius)');
        if (cloudButton) {
          await cloudButton.click();
          await page.waitForTimeout(500);

          // Check for warning
          const warning = await page.$('text=Privacy Concern');
          if (warning) {
            console.log('✅ Privacy warning appears when overriding Cybersecurity to Cloud');
            await page.screenshot({ path: 'cybersecurity_warning.png', fullPage: true });
          } else {
            console.log('⚠️  No privacy warning found');
          }
        }
      }
    }

    // Test Real Estate Advisor anonymization
    console.log('\nTesting Real Estate Advisor anonymization settings...');
    await page.click('text=General');
    await page.waitForTimeout(300);
    const realEstateAdvisor = await page.$('text=Real Estate Advisor');
    if (realEstateAdvisor) {
      await realEstateAdvisor.click();
      await page.waitForTimeout(500);

      const settingsButtons = await page.$$('button[title="Configure persona"]');
      if (settingsButtons.length > 1) {
        await settingsButtons[1].click();
        await page.waitForTimeout(1000);

        // Click Privacy tab
        await page.click('text=Privacy');
        await page.waitForTimeout(500);

        // Click Hybrid mode
        const hybridButton = await page.$('text=Hybrid');
        if (hybridButton) {
          await hybridButton.click();
          await page.waitForTimeout(500);

          // Check for required anonymization message
          const required = await page.$('text=Anonymization Required');
          if (required) {
            console.log('✅ Real Estate shows "Anonymization Required"');
            await page.screenshot({ path: 'real_estate_anonymization.png', fullPage: true });
          } else {
            console.log('⚠️  No "Anonymization Required" message found');
          }
        }
      }
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    await browser.close();
  }
}

verify();
