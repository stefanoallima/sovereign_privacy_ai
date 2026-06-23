// Test script for persona selector integration

(async () => {
  console.log('=== PERSONA SELECTOR INTEGRATION TEST ===');
  console.log('Test Start Time:', new Date().toISOString());
  
  // Wait for initial page load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check for persona selector
  const selectors = [
    '[data-testid="persona-selector"]',
    '[role="combobox"]',
    'select[id*="persona"]',
    'button[data-testid*="persona"]',
    '.persona-selector',
    '#persona-select'
  ];
  
  let selectorElement = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      selectorElement = el;
      console.log('Found persona selector:', selector);
      break;
    }
  }
  
  if (!selectorElement) {
    console.warn('Could not find persona selector with predefined selectors');
    console.log('Searching for dropdown/select elements...');
    
    // Look for any select or combobox
    selectorElement = document.querySelector('select') || 
                     document.querySelector('[role="combobox"]') ||
                     document.querySelector('[role="listbox"]');
  }
  
  if (selectorElement) {
    console.log('Persona selector element found:', selectorElement.tagName);
    console.log('Element HTML:', selectorElement.outerHTML.substring(0, 200));
    
    // Try to click it
    selectorElement.click();
    console.log('Clicked persona selector');
    
    // Wait for dropdown to open
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Look for persona options
    const options = document.querySelectorAll('[role="option"], option, [data-testid*="persona"], li[data-persona]');
    console.log('Persona options found:', options.length);
    
    if (options.length > 0) {
      const personas = [];
      options.forEach((option, index) => {
        const text = option.textContent.trim();
        const icon = option.querySelector('span')?.textContent || '';
        console.log(`Persona ${index + 1}: ${text} ${icon}`);
        personas.push({
          name: text,
          icon: icon,
          element: option.outerHTML.substring(0, 100)
        });
      });
      console.log('Total personas:', personas.length);
      console.log('Personas JSON:', JSON.stringify(personas, null, 2));
    }
  } else {
    console.error('Persona selector not found');
  }
  
  // Check for console errors
  console.log('=== CONSOLE STATUS ===');
  console.log('Page loaded successfully at:', window.location.href);
  
})();
