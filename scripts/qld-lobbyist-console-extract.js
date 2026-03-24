/**
 * QLD Lobbyist Register — Browser Console Extraction Script
 * 
 * Usage:
 *   1. Navigate to https://lobbyists.integrity.qld.gov.au/Lobbying-Register/Search-lobbyists/
 *   2. Wait for the table to fully load
 *   3. Open DevTools (F12) → Console
 *   4. Paste this entire script and press Enter
 *   5. CSV will auto-download
 * 
 * For clients: navigate to Search-clients page and run the client variant below.
 */

// === LOBBYIST EXTRACTION ===
(async function extractLobbyists() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const results = [];

  // Method 1: Try reading from the rendered DOM table
  function readTable() {
    const rows = document.querySelectorAll(
      '.view-grid table tbody tr, ' +
      '.entity-grid table tbody tr, ' +
      'table.table tbody tr'
    );
    const extracted = [];
    rows.forEach(row => {
      const cells = [...row.querySelectorAll('td')];
      if (cells.length >= 1) {
        // First visible text cell is typically the entity/trading name
        const texts = cells.map(c => c.textContent.trim()).filter(t => t.length > 0);
        if (texts.length > 0) {
          extracted.push({
            name: texts[0] || '',
            abn: texts.find(t => /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/.test(t.replace(/\s/g, ''))) || '',
            raw: texts,
          });
        }
      }
    });
    return extracted;
  }

  // Read current page
  let currentPage = readTable();
  results.push(...currentPage);
  console.log(`Page 1: ${currentPage.length} rows`);

  // Try clicking through pagination
  let pageNum = 1;
  while (true) {
    const nextBtn = document.querySelector(
      '.pagination .next a, ' +
      'a[aria-label="Next"], ' +
      'li.next a, ' +
      '.pagination a[rel="next"]'
    );
    
    if (!nextBtn || nextBtn.parentElement?.classList.contains('disabled')) {
      console.log('No more pages.');
      break;
    }

    nextBtn.click();
    await delay(2000); // Wait for page load
    pageNum++;
    
    currentPage = readTable();
    if (currentPage.length === 0) {
      console.log(`Page ${pageNum}: empty, stopping.`);
      break;
    }
    
    results.push(...currentPage);
    console.log(`Page ${pageNum}: ${currentPage.length} rows (total: ${results.length})`);
    
    if (pageNum > 20) {
      console.warn('Safety limit: stopped at 20 pages.');
      break;
    }
  }

  // Deduplicate by name
  const unique = new Map();
  for (const r of results) {
    if (r.name && !unique.has(r.name)) {
      unique.set(r.name, r);
    }
  }

  const deduped = [...unique.values()];
  console.log(`\nTotal unique lobbyists: ${deduped.length}`);

  // Generate CSV
  const csvLines = ['lobbyist_name,lobbyist_abn,client_name,client_abn'];
  for (const r of deduped) {
    const name = r.name.replace(/"/g, '""');
    const abn = (r.abn || '').replace(/[^0-9]/g, '');
    csvLines.push(`"${name}","${abn}","",""`);
  }

  const csv = csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qld-lobbyists.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`\nDownloaded qld-lobbyists.csv with ${deduped.length} lobbyist entries.`);
  console.log('Next steps:');
  console.log('  1. Navigate to Search Clients page');
  console.log('  2. Run the client extraction script');
  console.log('  3. Merge both CSVs into one file at data/qld-lobbyists.csv');
  
  // Also log the raw data to console for copy-paste
  console.log('\nRaw data (JSON):');
  console.log(JSON.stringify(deduped, null, 2));
  
  return deduped;
})();


// === CLIENT EXTRACTION (run on Search-clients page) ===
// Uncomment the block below when on the clients page:
/*
(async function extractClients() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const results = [];

  function readTable() {
    const rows = document.querySelectorAll('table.table tbody tr, .view-grid table tbody tr');
    const extracted = [];
    rows.forEach(row => {
      const cells = [...row.querySelectorAll('td')];
      const texts = cells.map(c => c.textContent.trim()).filter(t => t.length > 0);
      if (texts.length >= 2) {
        extracted.push({
          client_name: texts[0] || '',
          lobbyist_name: texts[1] || '',
          raw: texts,
        });
      }
    });
    return extracted;
  }

  let currentPage = readTable();
  results.push(...currentPage);
  console.log(`Page 1: ${currentPage.length} client rows`);

  let pageNum = 1;
  while (true) {
    const nextBtn = document.querySelector('.pagination .next a, a[aria-label="Next"], li.next a');
    if (!nextBtn || nextBtn.parentElement?.classList.contains('disabled')) break;
    nextBtn.click();
    await delay(2000);
    pageNum++;
    currentPage = readTable();
    if (currentPage.length === 0) break;
    results.push(...currentPage);
    console.log(`Page ${pageNum}: ${currentPage.length} rows (total: ${results.length})`);
    if (pageNum > 50) break;
  }

  console.log(`\nTotal client records: ${results.length}`);
  
  const csvLines = ['lobbyist_name,lobbyist_abn,client_name,client_abn'];
  for (const r of results) {
    const lobName = (r.lobbyist_name || '').replace(/"/g, '""');
    const clientName = (r.client_name || '').replace(/"/g, '""');
    csvLines.push(`"${lobName}","","${clientName}",""`);
  }

  const csv = csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qld-clients.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded qld-clients.csv`);
})();
*/
