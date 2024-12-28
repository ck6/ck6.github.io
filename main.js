
/************************************************************
 * Telegram Setup & Basic Data
 ************************************************************/
const tg = window.Telegram.WebApp;
tg.expand();
tg.requestFullscreen();
//tg.WebApp.MainButton.hide();
tg.setBackgroundColor("#000000");
tg.onEvent('mainButtonClicked', () => {
  tg.close();
});

let userId = "x12345688"; // fallback if we don't get Telegram user ID
document.getElementById("player-avatar").innerHTML = '<img src="ik.jpg" alt="IK">';
document.getElementById("player-name").innerHTML = 'IK';

const user = tg.initDataUnsafe?.user;
const initData = tg.initData;

if (user) {
  userId = String(user.id);
  const firstName = user.first_name;
  const lastName = user.last_name;
  const username = user.username;
  const profilephoto = user.photo_url;
  const isPremium = user.is_premium;
  // 3) Extract the value of a parameter (e.g., "foo")
  //const initDataUnsafe = Telegram.WebApp.initDataUnsafe;

  // 3) The start param is here (if any was passed)
  const startParam1 = tg.initDataUnsafe.start_param;
  
      document.getElementById("player-avatar").innerHTML = '<img src="' + profilephoto +'" alt="'+ username +'">';
      document.getElementById("player-name").innerHTML = firstName + " " + lastName;

    
}


/************************************************************
 * We'll track user state from the server:
 ************************************************************/
let userState = null; // { cookiesOwned, chocolateReveals, totalFeeds, revealedTiles, ... }
let currentClusterIndex = 0;
let currentClusterData = null;

// For friend invites (local only)
let invitedFriends = 0;

/************************************************************
 * We'll also replicate your original pastel & emoji logic
 * for the UNREVEALED tiles. This is purely client-side "decoration".
 ************************************************************/
const pastelGradients = [
  "linear-gradient(135deg, #fbc2eb 0%, #a18cd1 100%)",
  "linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)"
];
//const emojis = ["🐱","🐾","🌸","💖","🍀","🌙","⭐","🦴","💎","📦","🎀","💕"];
const emojis = ["🐱","🐾","🌸","💖","🍀","🌙","⭐","🐭","💎","📦","🎀","💕", "🐹","🐥","🐣", "🐟"];


// We'll store "decorations" for 10 clusters × (5 rows × 5 cols)
let clusterDecor = [];




/************************************************************
 * On window load, let's fetch the user state and build the grid
 ************************************************************/
window.onload = async () => {
  // Show the welcome popup
  document.getElementById('onLoadPopup').style.display = 'flex';

  // 3) Choose a random cluster index from 0..9
  const randomIndex = Math.floor(Math.random() * 1000000);

  // 4) Start loading that cluster in parallel
  //const clusterPromise = loadCluster(randomIndex);
  //await loadCluster(randomIndex);

  // 2) Fetch user state
  //const userPromise = fetchUserState();
  await fetchUserState();

 // await loadCluster(randomIndex);
  
  await resumeClusterOrPickNew();
  
  // 5) Wait for both
  //await Promise.all([userPromise, clusterPromise]);

  // 6) Now both userState & cluster data are ready
  updateFeedingProgress();

  // Confetti for fun
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);

  sendUserProfileToServer();


}

/************************************************************
 * 1) Fetch user state from /api/userState?userId=...
 ************************************************************/
async function fetchUserState() {
  try {
    // Encode initData for safe usage in query parameters
    const encodedInitData = encodeURIComponent(tg.initData);

    // Now call /api/userState with initData in the URL
    const res = await fetch(`https://chonk.fly.dev/api/userState?initData=${encodedInitData}`);
    const data = await res.json();

    if (data.error) {
      console.error("Error fetching user state:", data.error);
      alert(data.error);
      return;
    }

    // data is presumably the user doc
    userState = data;
    updateBalances();
  } catch (err) {
    console.error("Error fetching user state:", err);
    alert("Error fetching user state!");
  }
}


async function sendUserProfileToServer() {
  // 1) Check if we have user data from Telegram
  const userObj = tg.initDataUnsafe?.user;
  if (!userObj) {
    alert("No user info from Telegram!");
    return;
  }

  // 2) Extract the relevant fields
  const userId       = userObj.id;               // numeric
  const firstName    = userObj.first_name || "";
  const lastName     = userObj.last_name || "";
  const username     = userObj.username || "";
  const photoUrl     = userObj.photo_url || "";
  const languageCode = userObj.language_code || "";
  const invitedByID = tg.initDataUnsafe.start_param || null;
  const isPremium = userObj.is_premium ? 1 : 0;
  //const initData     = tg.initData;

  // 3) POST them to your backend
  try {
    const res = await fetch("https://chonk.fly.dev/api/updateUserProfile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        firstName,
        lastName,
        username,
        photoUrl,
        languageCode,
        invitedBy: invitedByID,
        isPremium,
        initData: initData
      })
    });
    const data = await res.json();
    if (data.error) {
      console.error("Error updating user profile:", data.error);
      alert("Error updating user profile: " + data.error);
      return;
    }
    console.log("Profile updated successfully in DB.");
  } catch (err) {
    console.error("Error sending profile to server:", err);
    alert("Could not update user profile: " + err.message);
  }
}


/************************************************************
 * 2) Create the 5x5 hex grid for the current cluster
 *    - If tile is revealed, show the actual reward
 *    - If not revealed, show pastel + random emoji
 ************************************************************/
function ensureDecorForCluster(clusterIndex, rows, cols) {
  // If this cluster index hasn't been decorated yet, make an array
  if (!clusterDecor[clusterIndex]) {
    clusterDecor[clusterIndex] = [];
  }
  // For each row and col in the cluster, ensure we have a pastel+emoji object
  for (let r = 0; r < rows; r++) {
    if (!clusterDecor[clusterIndex][r]) {
      clusterDecor[clusterIndex][r] = [];
    }
    for (let c = 0; c < cols; c++) {
      if (!clusterDecor[clusterIndex][r][c]) {
        const gradient = pastelGradients[Math.floor(Math.random() * pastelGradients.length)];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        clusterDecor[clusterIndex][r][c] = { gradient, emoji };
      }
    }
  }
}


async function fetchSingleCluster(index) {
  try {
    const res = await fetch(`https://chonk.fly.dev/api/clusters/${index}`);
    const data = await res.json();
    // data => { clusterIndex, tiles: [ [...], [...], ... ] } or { error: ... }
    if (data.error) {
      alert("Error fetching cluster: " + data.error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error in fetchSingleCluster:", err);
    alert("Error fetching cluster index " + index);
    return null;
  }
}

// Then we can define a function to load a cluster doc into currentClusterData
async function loadCluster(index) {
  currentClusterIndex = index;

  // Update the heading in the DOM to show "Cluster # + 1"
  document.getElementById('clusterNumber').textContent = (currentClusterIndex + 1).toLocaleString();

  if (userState) {
    document.getElementById('clusterCookies').textContent = userState.cookiesOwned || 0;
    document.getElementById('clusterChocolate').textContent = userState.chocolateReveals || 0;
  }

  currentClusterData = await fetchSingleCluster(index);
  if (currentClusterData) {
    createHexGrid();
  }
  // else handle error
}



function createHexGrid() {
  const container = document.getElementById('hexGridContainer');
  container.innerHTML = "";

  // If no user or no cluster data, stop
  if (!userState) return;
  if (!currentClusterData || !currentClusterData.tiles) {
    console.warn("No cluster data loaded!");
    return;
  }

  // Build a map of per-user reveals (if you still want personal reveal logic)
  let revealedTiles = userState.revealedTiles?.[currentClusterIndex] || [];
  const revealedMap = new Map();
  revealedTiles.forEach(obj => {
    const key = `${obj.row},${obj.col}`;
    revealedMap.set(key, obj.reward);
  });

  // The server’s “tiles” array is the global source of truth
  const tiles2D = currentClusterData.tiles; // e.g. 2D array of size rows×cols
  const rows = tiles2D.length;
  const cols = tiles2D[0].length;

  // Ensure we have enough pastel decor for this dimension
  ensureDecorForCluster(currentClusterIndex, rows, cols);

  for (let r = 0; r < rows; r++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'hex-row';

    for (let c = 0; c < cols; c++) {
      const hex = document.createElement('div');
      hex.className = 'hex';

      // The server’s global tile state
      const globalVal = tiles2D[r][c]; // "???" or "0.25 USDT" etc.
      // The user’s personal reveal state
      const userVal = revealedMap.get(`${r},${c}`);

      if (globalVal !== "???") {
        // The tile is globally revealed
        hex.classList.add('revealed');

        //hex.textContent = globalVal;
        //ADD THIS IF REMOVING AVATARS

        // Instead of plain text, show random avatar + reward
        const randomAvatarUrl = `https://i.pravatar.cc/40?img=${Math.floor(Math.random() * 70)}`;
        // You can adjust width/height for a bigger or smaller avatar
        const tileHTML = `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="rewardText" style="font-size: 16px; margin-bottom: 5px;">
              ${globalVal}
            </div>
            <img 
              src="${randomAvatarUrl}" 
              style="border-radius: 50%; width: 24px; height: 24px;" 
              alt="Random Avatar"
            />
          </div>
        `;
        hex.innerHTML = tileHTML;
      } else {
        // Not revealed => pastel background + random emoji
        const decor = clusterDecor[currentClusterIndex][r][c];
        hex.textContent = decor.emoji;
        hex.style.background = decor.gradient;
        // On click, attempt to reveal
        hex.onclick = () => onHexClick(r, c, hex);
      }

      rowDiv.appendChild(hex);
    }

    container.appendChild(rowDiv);
  }
}

/************************************************************
 * 3) Reveal a tile: POST /api/revealTile
 *    - Flip animation, then show reward in tile (no popup alert)
 ************************************************************/
async function onHexClick(row, col, element) {
  if (!userState) return;

  // Check if user has cookie or choc reveal
if (userState.cookiesOwned <= 0 && userState.chocolateReveals <= 0) {
  showNoCookiesPopup();
  return;
}

  // Flip animation
  element.classList.add('flipping');

  // Send request to server
  try {
    const res = await fetch('https://chonk.fly.dev/api/revealTile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        userId,
        clusterIndex: currentClusterIndex,
        row, col
      })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      element.classList.remove('flipping');
      return;
    }

    // data.reward, data.cookiesOwned, data.chocolateReveals, data.totalFeeds
    userState.cookiesOwned = data.cookiesOwned;
    userState.chocolateReveals = data.chocolateReveals;
    userState.totalFeeds = data.totalFeeds;

    // We also need to store the newly revealed tile in userState
    if (!userState.revealedTiles[currentClusterIndex]) {
      userState.revealedTiles[currentClusterIndex] = [];
    }
    userState.revealedTiles[currentClusterIndex].push({
      row, col, reward: data.reward
    });

    // After the flip finishes (0.2s), show the reward
    setTimeout(() => {
      element.classList.remove('flipping');
      element.classList.add('revealed');
      element.textContent = data.reward;
    }, 200);

    if (data.reward != "0") {shoot();}
//await loadCluster(currentClusterIndex);
    updateBalances();
    updateFeedingProgress();
  } catch (err) {
    console.error(err);
    alert("Error revealing tile: " + err.message);
    element.classList.remove('flipping');
  }
}


//BOMB REVEAL

async function useBombOnCurrentCluster() {
  try {
    if (!userState || userState.chocolateBombs < 1) {
      alert("You have no bombs!");
      return;
    }
    // Confirm or skip this
    const confirmUse = confirm("Use 1 Bomb to reveal the entire cluster?");
    if (!confirmUse) return;

    // POST /api/useBomb
    const res = await fetch('https://chonk.fly.dev/api/useBomb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        userId,                 // from your code
        clusterIndex: currentClusterIndex
      })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }

    //alert(data.message);

    // Merge newly revealed tiles into userState
   if (!userState.revealedTiles[currentClusterIndex]) {
     userState.revealedTiles[currentClusterIndex] = [];
   }
   data.newlyRevealedRewards.forEach(({ row, col, reward }) => {
     userState.revealedTiles[currentClusterIndex].push({ row, col, reward });
   });

   // Flip them all in the DOM
   flipAllNewlyRevealedTiles(data.newlyRevealedRewards);

    // Update local userState
    userState.chocolateBombs = data.chocolateBombs;
    userState.cookiesOwned = data.cookiesOwned;
    userState.chocolateReveals = data.chocolateReveals;

    // Also update revealedTiles
    if (!userState.revealedTiles[currentClusterIndex]) {
      userState.revealedTiles[currentClusterIndex] = [];
    }
    data.newlyRevealedRewards.forEach(({ row, col, reward }) => {
      userState.revealedTiles[currentClusterIndex].push({ row, col, reward });
    });

    // Now re-render the cluster to show everything as revealed
    await loadCluster(currentClusterIndex);
    //OTHERWISE WE CAN'T SEE THE FLIP

    // Update balances, etc.
    updateBalances();
    updateFeedingProgress();
  } catch (err) {
    console.error("Error using bomb:", err);
    alert("Error: " + err.message);
  }
}

function flipAllNewlyRevealedTiles(newRewards) {
  // 1) Clear old classes
  newRewards.forEach(({ row, col }) => {
    const tile = document.querySelector(`.hex[data-row="${row}"][data-col="${col}"]`);
    if (!tile) return;
    tile.classList.remove('flipping', 'revealed');
    // tile.textContent = ''; // optional
  });

  // 2) Force reflow so the next .flipping addition is recognized as a new transition
  document.body.offsetHeight;

  // 3) Add 'flipping' class
  newRewards.forEach(({ row, col, reward }) => {
    const tile = document.querySelector(`.hex[data-row="${row}"][data-col="${col}"]`);
    if (!tile) return;

    tile.classList.add('flipping');
    setTimeout(() => {
      tile.classList.remove('flipping');
      tile.classList.add('revealed');
      tile.textContent = reward;
    }, 200);
  });
}




/************************************************************
 * 4) Random or selected cluster
 ************************************************************/
function loadRandomCluster() {
  const randIndex = Math.floor(Math.random() * 1000000);
  loadCluster(randIndex);
  updateBalances();
}
function selectCluster() {
  const clusterNumber = prompt("Enter cluster number (1-1,000,000):");
  const num = parseInt(clusterNumber, 10);
  if (!isNaN(num) && num >= 1 && num <= 1000000) {
    loadCluster(num - 1);
    updateBalances();
  } else {
    alert("Invalid cluster number. Please enter a number between 1 and 1,000,000.");
  }
}


//LOAD LAST ACTIVE CLUSTER OR RANDOM NEW ONE

async function resumeClusterOrPickNew() {
  // 1) If userState doesn’t exist, or lastClusterIndex is null/undefined, just load random
  if (!userState || userState.lastClusterIndex == null) {
    loadRandomCluster();
    return;
  }

  // 2) We have a lastClusterIndex, so check if it’s fully revealed
  const clusterIndex = userState.lastClusterIndex;
  const clusterData = await fetchSingleCluster(clusterIndex);
  if (!clusterData || clusterData.error) {
    // If we fail to fetch, just do random
    loadRandomCluster();
    return;
  }

  // 3) Check if clusterData.tiles contains any "???"
  //    If none, it’s fully revealed => do random
  let isFullyRevealed = true;
  for (let rowArr of clusterData.tiles) {
    for (let cell of rowArr) {
      if (cell === "???") {
        isFullyRevealed = false;
        break;
      }
    }
    if (!isFullyRevealed) break;
  }

  if (isFullyRevealed) {
    // choose random
    loadRandomCluster();
  } else {
    // resume user’s cluster
    loadCluster(clusterIndex);
  }
}



/************************************************************
 * 5) Buying cookies
 ************************************************************/

//let isOpeningInvoice = false;



async function handleBuyCookieButtonClick(event, revealType) {
  //const buyCookieBtn = document.querySelector('.buy-cookie-button');
  const thisButton = event.currentTarget;

  // Animate only this button
  thisButton.classList.add('button-animate');
  setTimeout(() => {
    thisButton.classList.remove('button-animate');
  }, 300);


  try {
    // 1) Request an invoice link from your backend
    const res = await fetch('https://chonk.fly.dev/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revealType: revealType })
    });
    const data = await res.json();

    if (!data.invoiceLink) {
      alert("Failed to get invoice link from server!");
      return;
    }

    // 2) Open the invoice inside Telegram
    tg.openInvoice(data.invoiceLink, async (status) => {
      console.log("Invoice status:", status);
      if (status === "paid") {

        setTimeout(async () => {
        await fetchUserState();
        }, 400);
        // Now call your existing /api/buyCookie to finalize the purchase
    
      }
    });
  } catch (err) {
    console.error("Error creating or opening invoice:", err);
    alert("Error: " + err.message);
  }
}



async function buyChocolateCookie() {
  if (invitedFriends < 3) {
    alert("You need to invite at least 3 friends first!");
    return;
  }
  try {
    const res = await fetch('https://chonk.fly.dev/api/buyChocolateCookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    userState.chocolateReveals = data.chocolateReveals;
    showConfetti();
    alert("You got a Chocolate Cookie, worth 3 reveals!");
    updateBalances();
  } catch (err) {
    console.error(err);
    alert("Error buying chocolate cookie: " + err.message);
  }
}


async function buyProduct(productType, userId, cookiesToAdd = 0) {
  try {
    const response = await fetch('https://chonk.fly.dev/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productType, 
        userId,
        cookiesToAdd  // how many cookies to add if it’s a cookie product
      })
    });
    const data = await response.json();

    if (!data.invoiceLink) {
      alert(`Failed to get invoice link for ${productType}!`);
      return;
    }

    tg.openInvoice(data.invoiceLink, async (status) => {
      if (status === 'paid') {
        // On success, you can either:
        //   1) Wait for the payment handler in your Bot code to update the DB, OR
        //   2) Make an extra POST here to confirm the purchase.
        // Typically, it's simpler to rely on the telegram 'successful_payment' logic.
        alert('Payment completed! Check your cookies or cluster now.');
      }
    });

  } catch (err) {
    console.error('Error creating invoice:', err);
    alert('Error creating invoice: ' + err.message);
  }
}




/************************************************************
 * 6) Inviting friends (local logic)
 ************************************************************/
function inviteFriend() {
  invitedFriends++;
  //document.getElementById('friendsInvitedCount').textContent = invitedFriends;

  if (invitedFriends >= 1) {
    document.getElementById('buyChocCookieBtn').disabled = false;
    document.getElementById('chocCookieInfo').textContent = "You can now buy Chocolate Cookies!";
    document.getElementById('chocCookieInfo').style.color = '#0f0';
  }
  if (invitedFriends % 10 === 0) {
    userState.cookiesOwned++;
    alert("You got a free Cookie for inviting 10 friends!");
    updateBalances();
  }
}

function shareMiniApp() {
  // 1) Construct your personal link
  //    - If you have a Telegram Bot with a start param, do something like:
  const personalLink = `https://t.me/LuckyChonkBot/LuckyChonk?startapp=${userId}`;

  // 2) Open Telegram's share URL in a new tab.
  //    - This is a standard approach to let the user pick a chat to send it to.
  //    - You can also add a custom text or message if you want.
  const encodedLink = encodeURIComponent(personalLink);
  const encodedMessage = encodeURIComponent("Check out this BTC Hiding Chonk and change your life forever!");
  const shareUrl = `https://t.me/share/url?url=${encodedLink}&text=${encodedMessage}`;


  
  if (invitedFriends >= 3) {
    document.getElementById('buyChocCookieBtn').disabled = false;
    document.getElementById('chocCookieInfo').textContent = "You can now buy Chocolate Cookies!";
    document.getElementById('chocCookieInfo').style.color = '#0f0';
  }

  window.open(shareUrl, "_blank");
}

function copyLinkToClipboard() {
  // 1. Construct the same personal link you use for the share
  const personalLink = `https://t.me/LuckyChonkBot/LuckyChonk?startapp=${userId}`;
  
  // 2. Copy to clipboard using the modern Clipboard API
  navigator.clipboard.writeText(personalLink)
    .then(() => {
      alert("Link copied! You can now share it anywhere.");
    })
    .catch(err => {
      console.error("Failed to copy link to clipboard:", err);
      alert("Error copying the link. Please manually copy: " + personalLink);
    });
}




/************************************************************
 * 7) Show/hide tabs
 ************************************************************/
function showTab(tab) {
  // First, remove active class from all bottom-nav buttons
  document.querySelectorAll('.bottom-nav button')
    .forEach(btn => btn.classList.remove('active'));

  // Then, add active to the current tab’s button
  document.getElementById(tab + 'Tab').classList.add('active');

  // Hide all .tab-content, show only the requested one
  document.querySelectorAll('.tab-content')
    .forEach(content => content.classList.remove('active'));
  document.getElementById(tab + 'Content').classList.add('active');

  // Now show or hide the cluster-buttons
  const clusterBtns = document.querySelector('.cluster-buttons');
  if (clusterBtns) {
    if (tab === 'field') {
      clusterBtns.style.display = 'flex';
    } else {
      clusterBtns.style.display = 'none';
    }
  }

  if (tab === 'stats') {
    fetchLeaderboard();  // load or refresh the top chonkers
  }

  // If you want to refresh balances on certain tabs:
  if (['balance', 'stats', 'bonuses', 'store'].includes(tab)) {
    updateBalances();
  }
}



/************************************************************
 * 8) Update Balances & Feeds display
 ************************************************************/
function updateBalances() {
  if (!userState) return;
  const cookiesOwned = userState.cookiesOwned || 0;
  const choc = userState.chocolateReveals || 0;
  const bombs = userState.chocolateBombs || 0;
  const friendsInvited = userState.friendsInvited || 0;

  let totalBTC = 0;
  let totalUSDT = 0;
  let totalTON = 0;


  //Bonuses tab
  document.getElementById('friendsInvitedCount').textContent = friendsInvited;
  
  // Store tab
  document.getElementById('storeCookieBalances').textContent =
  `Cookies: ${cookiesOwned} | Choc: ${choc} | Bombs: ${bombs}`;

  // Balance tab
  //document.getElementById('cookieLine').textContent = 
    `Cookies: ${cookiesOwned} | Choc: ${choc}`;

    // Update the cluster heading if we want to see it reflect changes immediately
  document.getElementById('clusterCookies').textContent = cookiesOwned;
  document.getElementById('clusterChocolate').textContent = choc;
   document.getElementById('clusterBombs').textContent = bombs;

  //  // Show or hide the Bomb button
  const bombBtn = document.getElementById('useBombButton');
  if (bombBtn) {
    bombBtn.style.display = (bombs > 0) ? 'inline-block' : 'none';
  }

  // Example: if you want to display actual BTC/USDT/TON from userState, you can do so here.
  // For now, let's assume we don't have that data from the server. We'll keep them 0:
// Loop over all clusters the user has revealed
  for (let cIndex in userState.revealedTiles) {
    const tilesArray = userState.revealedTiles[cIndex];
    for (let tile of tilesArray) {
      // tile.reward is something like "0.25 USDT" or "1 BTC"
      const [amountStr, currency] = tile.reward.split(" "); 
      const amount = parseFloat(amountStr) || 0;

      if (!currency) continue;

      switch (currency.toUpperCase()) {
        case "BTC":
          totalBTC += amount;
          break;
        case "USDT":
          totalUSDT += amount;
          break;
        case "TON":
          totalTON += amount;
          break;
        default:
          // If some unknown currency, skip or handle accordingly
          break;
      }
    }
  }


  // Already have totalBTC, totalUSDT, totalTON from the loop
  const btcInUSD = totalBTC * 100000;  // adjust if your code uses a different BTC value
  const usdtInUSD = totalUSDT;         // 1 USDT = $1
  const tonInUSD = totalTON * 6;       // 1 TON = $6 (example)

  const totalProfitUSD = btcInUSD + usdtInUSD + tonInUSD;

  // Update the “playerProfit” element
  const profitEl = document.getElementById('playerProfit');
  if (profitEl) {
    profitEl.textContent = "Lifetime Earnings: $" + totalProfitUSD.toFixed(2);
  }
  // Now update the UI elements
  document.getElementById('btcBalance').textContent = totalBTC.toFixed(2);
  document.getElementById('btcUSD').textContent = `~$${btcInUSD.toFixed(2)}`;

  document.getElementById('usdtBalance').textContent = totalUSDT.toFixed(2);
  document.getElementById('usdtUSD').textContent = `~$${(totalUSDT).toFixed(2)}`;

  document.getElementById('tonBalance').textContent = totalTON.toFixed(2);
  document.getElementById('tonUSD').textContent = `~$${tonInUSD.toFixed(2)}`;

  // update wallet tab too
  document.getElementById('btcBalanceWallet').textContent = totalBTC.toFixed(2);
  document.getElementById('btcUSDWallet').textContent = `~$${btcInUSD.toFixed(2)}`;

  document.getElementById('usdtBalanceWallet').textContent = totalUSDT.toFixed(2);
  document.getElementById('usdtUSDWallet').textContent = `~$${(totalUSDT).toFixed(2)}`;

  document.getElementById('tonBalanceWallet').textContent = totalTON.toFixed(2);
  document.getElementById('tonUSDWallet').textContent = `~$${tonInUSD.toFixed(2)}`;

  document.getElementById('playerFeeds').textContent = `Total Feeds: ${userState.totalFeeds}`;


  //document.getElementById('statsBalances').innerHTML =
  //  `₿ BTC: ${totalBTC.toFixed(2)} (~$${(totalBTC * 100000).toFixed(2)}) <br>`
  //  + `💵 USDT: ${totalUSDT.toFixed(2)} (~$${(totalUSDT).toFixed(2)}) <br>`
  //  + `💎 TON: ${totalTON.toFixed(2)} (~$${(totalTON * 6).toFixed(2)})`;
}


/************************************************************
 * 9) Feeding / Chonk Level (local display)
 ************************************************************/
const LEVEL_THRESHOLDS = [10, 25, 50];
const LEVEL_BONUSES = [0, 1, 1.5, 2];

function getChonkLevel(feeds) {
  if (feeds >= 50) return 3;
  if (feeds >= 25) return 2;
  if (feeds >= 10) return 1;
  return 0;
}
function getNextThreshold(level) {
  if (level === 0) return 10;
  if (level === 1) return 25;
  if (level === 2) return 50;
  return 50;
}
function updateFeedingProgress() {
  if (!userState) return;
  const totalFeeds = userState.totalFeeds || 0;
  const level = getChonkLevel(totalFeeds);

  document.getElementById('totalFeeds').textContent = totalFeeds;
  document.getElementById('chonkLevel').textContent = level;
  document.getElementById('chonkBonus').textContent = LEVEL_BONUSES[level] + "%";

  const nextLevelRewardEl = document.getElementById('nextLevelReward');
  const feedingProgress = document.getElementById('feedingProgress');

  const nextThreshold = getNextThreshold(level);
  let currentBase = 0;
  if (level === 1) currentBase = 10;
  if (level === 2) currentBase = 25;
  if (level === 3) currentBase = 50;

  let required = nextThreshold - currentBase;
  let achieved = totalFeeds - currentBase;
  if (achieved < 0) achieved = 0;
  if (achieved > required) achieved = required;
  let percent = (achieved / required) * 100;

  if (level === 3) {
    percent = 100;
    nextLevelRewardEl.textContent = "Max level reached";
  } else {
    const nextBonus = LEVEL_BONUSES[level+1];
    nextLevelRewardEl.textContent = nextBonus + "% at " + nextThreshold + " feeds";
  }
  feedingProgress.style.width = percent + "%";
}

/************************************************************
 * 10) Popup & Confetti
 ************************************************************/
function closePopup() {
  document.getElementById('onLoadPopup').style.display = 'none';
}

// Confetti logic
function showConfetti() {
  const confettiOverlay = document.getElementById('confettiOverlay');
  confettiOverlay.style.display = 'block';
  setTimeout(() => {
    confettiOverlay.style.display = 'none';
  }, 1000);
}

const defaults = {
  spread: 360,
  ticks: 50,
  gravity: 0,
  decay: 0.94,
  startVelocity: 30,
  shapes: ["star"],
  colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
};

function shoot() {
  confetti({
    ...defaults,
    particleCount: 40,
    scalar: 1.2,
    shapes: ["star"],
  });
  confetti({
    ...defaults,
    particleCount: 10,
    scalar: 0.75,
    shapes: ["circle"],
  });
}


/////TON WALLET


// Create a connector
    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://ck6.github.io/tonconnect-manifest.json',
        buttonRootId: 'ton-connect'
    });

tonConnectUI.uiOptions = {
  actionsConfiguration: {
    returnStrategy: 'back',       // or 'https://mycustomurl' if you have a custom scheme
    skipRedirectToWallet: 'never' // ensures iOS doesn't block returning after sign
  }
};

//if (tonConnectUI.connected) {
  //  const currentAccount = tonConnectUI.account;
    //if (currentAccount) {
      //      alert(`Wallet object:\n\n${JSON.stringify(wallet, null, 2)}`);

    // You can also directly alert the address:
    //alert(`Wallet address: ${tonConnectUI.account?.address}`);
    //}
//}

// Listen for connection/disconnection events:
tonConnectUI.onStatusChange( async (wallet) => {
  if (wallet) {
    // Connected
    //alert(`Wallet object:\n\n${JSON.stringify(wallet, null, 2)}`);

    const walletStatusEl = document.getElementById("tonWalletStatus");
    // 1) Change text
    walletStatusEl.textContent = "Connected";
    // 2) Change color to light green
    walletStatusEl.style.color = "#0f0"; // or "lightgreen"

    await saveWalletAddress(tonConnectUI.account?.address);
    ///THIS WORKS - alert(tonConnectUI.account?.address);
    // You can also directly alert the address:
    //alert(`Wallet address: ${tonConnectUI.account?.address}`);
  } else {
    //alert("no wallet");
    // Disconnected or no wallet
    //alert('No wallet connected.');
  }
});

tonConnectUI.connectionRestored.then((restored) => {
  if (restored && tonConnectUI.account) {
    //alert('Connection restored:', tonConnectUI.account.address);
  } else {
    //alert('No previous connection found.');
  }
});

async function saveWalletAddress(tonWalletAddress) {
  // 1) Assume you have `userId` from Telegram’s `initDataUnsafe.user.id` or something similar
  if (!userId) {
    console.error("User ID is not available. Cannot save wallet address.");
    return;
  }


  try {
    const res = await fetch('https://chonk.fly.dev/api/updateWallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        initData: tg.initData,
        userId,           // your Telegram user ID
        tonWalletAddress  // the address from TON Connect
      })
    });
    const data = await res.json();

    if (data.error) {
      console.error("Error updating wallet:", data.error);
      //alert("Error updating wallet: " + data.error);
      return;
    }

    console.log("Wallet updated successfully:", data);
  } catch (err) {
    console.error("Error calling updateWallet:", err);
    //alert("Error saving wallet address: " + err.message);
  }
}




   // NOT USED 2. This function will open the wallet
    async function connectToWallet() {
      try {
        tonConnectUI.uiOptions = {
      twaReturnUrl: 'https://t.me/LuckyChonkBot'
      };
        const connectedWallet = await tonConnectUI.connectWallet();
        console.log("Connected wallet:", connectedWallet);
      alert(`connectedWallet = ${JSON.stringify(connectedWallet)}`); // just to debug
      if (!connectedWallet?.account?.address) {
        alert("No address found in connectedWallet!");
        return;
      }

      await saveWalletAddress(connectedWallet.account.address);

      } catch (error) {
        console.error("Error connecting to wallet:", error);
      }
    }


function showNoCookiesPopup() {
  document.getElementById("noCookiesPopup").style.display = "flex";
}

function goToStore() {
  // Hide the "no cookies" popup
  document.getElementById("noCookiesPopup").style.display = "none";
  
  // Switch to the Store tab
  showTab("store");
}


//LEADERBOARD
async function fetchLeaderboard() {
  try {
    // 1) Fetch data from /api/leaderboard
    const res = await fetch('https://chonk.fly.dev/api/leaderboard');
    const data = await res.json();  // data = [ { firstName, profilePhotoUrl, totalProfit }, ... ]

    // 2) Grab the container
    const container = document.getElementById('leaderboardContainer');
    container.innerHTML = ""; // clear old items

    // 3) Loop over the array
    data.forEach((user, index) => {
      const rank = index + 1;

      // Create the main wrapper
      const itemDiv = document.createElement('div');
      itemDiv.className = 'leaderboard-item boxy-card';

      // Avatar
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'leaderboard-item-avatar';
      const img = document.createElement('img');
      img.src = user.profilePhotoUrl || 'https://placekitten.com/200/200';
      avatarDiv.appendChild(img);

      // Info
      const infoDiv = document.createElement('div');
      infoDiv.className = 'leaderboard-item-info';

      const nameEl = document.createElement('h4');
      nameEl.textContent = user.firstName || "Anon";
      infoDiv.appendChild(nameEl);

      const profitEl = document.createElement('p');
      profitEl.textContent = `Profit: $${(user.totalProfit || 0).toFixed(2)}`;
      infoDiv.appendChild(profitEl);

      // Rank
      const rankDiv = document.createElement('div');
      rankDiv.className = 'leaderboard-item-rank';
      if (rank === 1) rankDiv.classList.add('rank-1');
      else if (rank === 2) rankDiv.classList.add('rank-2');
      else if (rank === 3) rankDiv.classList.add('rank-3');
      else rankDiv.classList.add('rank-default');
      rankDiv.textContent = `#${rank}`;

      // Combine them
      itemDiv.appendChild(avatarDiv);
      itemDiv.appendChild(infoDiv);
      itemDiv.appendChild(rankDiv);

      container.appendChild(itemDiv);
    });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
  }
}


//PREVENT DOUBLE TAP
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);




