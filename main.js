
/************************************************************
 * HOST URLS
 ************************************************************/

const hostname = window.location.hostname;
let BASE_API_URL;
switch (true) {
  case hostname.includes("localhost"):
    BASE_API_URL = "http://localhost:3000";
    break;
  case hostname.includes("experiments.services.fluffychonk.com"):
    BASE_API_URL = "https://chonk-1.services.fluffychonk.com";
    break;
  case hostname.includes("ck6.github.io"):
    BASE_API_URL = "https://chonk.fly.dev";
    break;
  default:
    BASE_API_URL = "https://chonk.fly.dev"; // fallback
}


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
const emojis = ["🐱","🐾","🌸","💖","🍀","🌙","⭐","🐭","💎","📦","💕", "🐹","🐥","🐣", "🐟", "🍣"];


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
  logUserEvent('game_opened');

}

/************************************************************
 * 1) Fetch user state from /api/userState?userId=...
 ************************************************************/
async function fetchUserState() {
  try {
    // Encode initData for safe usage in query parameters
    const encodedInitData = encodeURIComponent(tg.initData);

    // Now call /api/userState with initData in the URL
    const res = await fetch(`${BASE_API_URL}/api/userState?initData=${encodedInitData}`);
    const data = await res.json();

    if (data.error) {
      console.error("Error fetching user state:", data.error);
      alert(data.error);
      return;
    }

    // data is presumably the user doc
    userState = data;
    updateBalances();
    showBonuses();
  } catch (err) {
    console.error("Error fetching user state:", err);
    alert("Error fetching user state!", err);
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
    const res = await fetch(`${BASE_API_URL}/api/updateUserProfile`, {
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


///SHOW BONUSES

function showBonuses() {
  const permListEl = document.getElementById('permanentBonuses');
  const tempListEl = document.getElementById('temporaryBonuses');
  
  // Clear old contents
  permListEl.innerHTML = '';
  tempListEl.innerHTML = '';
  
  const permanent = userState?.bonuses?.permanentItems || [];
  const temporary = userState?.bonuses?.temporaryItems || [];
  const ephemeral = userState?.bonuses?.ephemeralItems || [];  // <-- add this

  // Show each permanent item
  permanent.forEach(item => {
    const li = document.createElement('li');
    const pct = (item.rate * 100).toFixed(2);
    li.textContent = `${item.name} (+${pct}%) forever`;
    permListEl.appendChild(li);
  });
  
  // Show each temporary (time-limited) item
  temporary.forEach(item => {
    const li = document.createElement('li');
    const pct = (item.rate * 100).toFixed(2);

    // maybe compute how many minutes left
    const msLeft = new Date(item.expiresAt) - Date.now();
    const minsLeft = Math.max(Math.floor(msLeft / 60000), 0);

    li.textContent = `${item.name} (+${pct}%) ~${minsLeft} min left`;
    tempListEl.appendChild(li);
  });

  // Show each ephemeral (reveal-limited) item
  ephemeral.forEach(item => {
    const li = document.createElement('li');
    const pct = (item.rate * 100).toFixed(2);

    // item.revealsLeft tells us how many reveals remain for this bonus
    li.textContent = `${item.name} (+${pct}%) for next ${item.revealsLeft} reveals`;
    tempListEl.appendChild(li);
  });
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
    const res = await fetch(`${BASE_API_URL}/api/clusters/${index}`);
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
    //document.getElementById('clusterChocolate').textContent = userState.chocolateReveals || 0;
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
       const userPhotoUrl = user?.photo_url;

        //hex.textContent = globalVal; //ADD THIS IF REMOVING AVATARS

       const userPhotoUrltemp = user?.photo_url;

        // Instead of plain text, show random avatar + reward
        //const randomAvatarUrl = `https://i.pravatar.cc/40?img=${Math.floor(Math.random() * 70)}`;
        // You can adjust width/height for a bigger or smaller avatar
        const tileHTML = `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="rewardText" style="font-size: 16px; margin-bottom: 5px;">
              ${globalVal}
            </div>
          </div>
        `;
        //            <img 
        //      src="${userPhotoUrltemp}" 
        //      style="border-radius: 50%; width: 24px; height: 24px;" 
        //      alt="Random Avatar"/>
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
    const res = await fetch(`${BASE_API_URL}/api/revealTile`, {
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

      if (data.zeroStreakBonusGranted) {
      showFreeCookiePopup();  // see function below
    }

    if (data.clusterCompletedReward) {
    // Show the new popup
    showClusterCompletePopup(data.clusterCompletedReward);
    }
    //await loadCluster(currentClusterIndex);

    updateBalances();
    updateFeedingProgress();
  } catch (err) {
    console.error(err);
    alert("Error revealing tile: " + err.message);
    element.classList.remove('flipping');
  }
}



function showClusterCompletePopup(bonusText) {
  const overlay = document.getElementById("clusterCompletePopup");
  const rewardEl = document.getElementById("clusterRewardText");
  const rewardImageEl = document.getElementById("clusterRewardImage");


  const rewardImages = {
  COOKIES: "cookie.webp",
  TON: "ton.png",
  USDT: "usdt.png"
  };

  const rewardType = getRewardType(bonusText)?.toUpperCase();
  const imageUrl = rewardImages[rewardType] || "crown.png"; // fallback


  if (overlay && rewardEl) {
    rewardEl.textContent = bonusText; // e.g. "2 Cookies" or "0.25 TON"
    overlay.style.display = "flex";   // show popup
    document.getElementById("clusterRewardImage").src = imageUrl;
  }
  // Confetti if you want
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
}

function closeClusterCompletePopup() {
  const overlay = document.getElementById("clusterCompletePopup");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function getRewardType(rewardString) {
  if (!rewardString) return null;
  
  // e.g. "2 Cookies" => ["2","Cookies"]
  //      "0.25 TON" => ["0.25","TON"]
  //      "1.50 USDT" => ["1.50","USDT"]
  const parts = rewardString.trim().split(" ");
  
  // The last word should be "Cookies", "TON", "USDT", etc.
  return parts[parts.length - 1]; 
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
    const res = await fetch(`${BASE_API_URL}/api/useBomb`, {
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

    shoot();

    if (data.clusterCompletedReward) {
    showClusterCompletePopup(data.clusterCompletedReward);
    }

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
  const randIndex = Math.floor(Math.random() * 1818181); //1818181 //2_380_953
  loadCluster(randIndex);
  updateBalances();
}
function selectCluster() {
  const clusterNumber = prompt("Enter cluster number (1-1,818,181):");
  const num = parseInt(clusterNumber, 10);
  if (!isNaN(num) && num >= 1 && num <= 1818181) {
    loadCluster(num - 1);
    updateBalances();
  } else {
    alert("Invalid cluster number. Please enter a number between 1 and 1,818,181.");
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
  thisButton.disabled = true;
  // do your normal code here ...
  
  // after or before you start the fetch
  setTimeout(() => {
    thisButton.disabled = false;
  }, 3000); // 3 seconds


  // Animate only this button
  thisButton.classList.add('button-animate');
  setTimeout(() => {
    thisButton.classList.remove('button-animate');
  }, 300);


  try {
    // 1) Request an invoice link from your backend
    const res = await fetch(`${BASE_API_URL}/api/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revealType: revealType,
        userId: userId, })
    });
    const data = await res.json();

  // (Optional) If you want to see the entire response data:
  //alert("Server says: " + JSON.stringify(data));

    if (!res.ok) {
    // That means the server responded with e.g. 400 or 403
    // Instead of "Failed to get invoice link", show data.error if present
    if (data?.error) {
      alert("Error from server: " + data.error);
    } else {
      alert("Unknown error from server. Status: " + res.status);
    }
    return;
  }

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







/************************************************************
 * 6) Inviting friends
 ************************************************************/

function shareMiniApp() {
  // 1) Construct your personal link
  //    - If you have a Telegram Bot with a start param, do something like:
  const personalLink = `https://t.me/LuckyChonkBot/LuckyChonk?startapp=${userId}`;

  // 2) Open Telegram's share URL in a new tab.
  //    - This is a standard approach to let the user pick a chat to send it to.
  //    - You can also add a custom text or message if you want.
  const encodedLink = encodeURIComponent(personalLink);
  const encodedMessage = encodeURIComponent("Check out the Lucky Chonk, find 5 BTC, 600K TON, lots of USDT, and change your life!");
  const shareUrl = `https://t.me/share/url?url=${encodedLink}&text=${encodedMessage}`;

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


  if (tab === 'bonuses') {
    // If the user has NOT already gotten the cookie, auto-check
    if (!userState?.channelCookieAwarded) {
      checkChannelJoin(); 
    } else {
      // Already claimed => show a green check
      const statusEl = document.getElementById("channelRewardStatus");
      if (statusEl) {
        statusEl.textContent = "✅";
        statusEl.style.color = "#4CAF50";

      }

        // Hide the cookie
      const cookieImg = document.getElementById("channelCookieImage");
      if (cookieImg) cookieImg.style.display = "none";
    }
  }



  //STORE LOGIC

  if (tab === 'store') {
    // If storeOpenedAt is null (meaning this user has never opened store)
    if (!userState.store || !userState.store.storeOpenedAt) {
      markStoreOpened().then(() => {
        // after we mark the store opened, re-fetch or set up countdown
        fetchUserState().then(() => {
          setupWelcomeCountdown();
        });
      });
    } else {
      // Already opened store before => just do the normal refresh or countdown
      fetchUserState().then(() => {
        setupWelcomeCountdown();
      });
    }

    logStoreOpened();
  }


  // Force the scroller to the top:
  const contentEl = document.querySelector('.content');
  if (contentEl) {
    contentEl.scrollTop = 0;
  }

}


async function markStoreOpened() {
  try {
    const res = await fetch(`${BASE_API_URL}/api/markStoreOpened`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg.initData
      })
    });
    const data = await res.json();
    if (data.error) {
      console.warn("markStoreOpened error:", data.error);
      return;
    }
    // data => { storeOpenedAt, welcomePackage: { expiresAt, purchased } }
    // Optionally store it in userState manually:
    if (!userState.store) userState.store = {};
    userState.store.storeOpenedAt = data.storeOpenedAt;
    userState.store.welcomePackage = data.welcomePackage;
  } catch (err) {
    console.error("Error calling /api/markStoreOpened:", err);
  }
}

function setupWelcomeCountdown() {
  const countdownEl = document.getElementById('welcomeCountdown');
  const welcomeItem = document.getElementById('welcomePackageItem');

  // 1) Check if userState.store.welcomePackage exists
  if (!userState?.store?.welcomePackage?.expiresAt) {
    // no expiration => hide countdown or do nothing
    countdownEl.textContent = "";
    return;
  }

  // 2) parse the expiresAt
  const expiresAtMs = new Date(userState.store.welcomePackage.expiresAt).getTime();

  // 3) define an update function
  function update() {
    const now = Date.now();
    const diff = expiresAtMs - now;
    if (diff <= 0) {
      countdownEl.textContent = "Expired";
      welcomeItem.style.display = "none";  // Hide the whole item
      clearInterval(intervalId);
      return;
    }

    // still time left => show h/m/s
    const totalSec = Math.floor(diff / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    countdownEl.textContent = `${hours}h ${minutes}m ${seconds}s left`;
  }

  // 4) start an interval to update every second
  update();  // run once immediately
  const intervalId = setInterval(update, 1000);
}


function updateStoreItemsUI() {
  // 1) Donut check
  //const donutBtn = document.getElementById("buyDonutButton"); 
  //const hasDonut = userState?.bonuses?.permanentItems?.some(
  //  (item) => item.name === 'DonutOfDestiny'
  //);

  //if (hasDonut && donutBtn) {
  //  donutBtn.disabled = true;
  //  donutBtn.textContent = "Owned";
    // or add a .locked style, etc.
  //}

    // 1) Hide the Welcome Package once purchased:
  const welcomePkgEl = document.getElementById("welcomePackageItem");
  if (welcomePkgEl && userState?.store?.welcomePackage?.purchased) {
    welcomePkgEl.style.display = "none";
  }

  // 2) Crown check
  //const crownBtn = document.getElementById("buyCrownButton");
  // We consider 'active' if expiresAt is in the future
  //const now = Date.now();
  //const hasActiveCrown = userState?.bonuses?.temporaryItems?.some(
  //  (item) => item.name === 'Crown' && new Date(item.expiresAt).getTime() > now
  //);

  //if (hasActiveCrown && crownBtn) {
  //  crownBtn.disabled = true;
  //  crownBtn.textContent = "Active";
    // or textContent = "Crown Running"
    // or show a countdown, etc.
  //}

  // 1) Grab the locked/unlocked store elements
  const bunchofcookiesLockedEl = document.getElementById('bunchofcookiesLocked');
  const bunchofcookiesUnlockedEl = document.getElementById('bunchofcookiesUnlocked');

  const candyLockedEl = document.getElementById('candyLocked');
  const candyUnlockedEl = document.getElementById('candyUnlocked');

  const donutLockedEl = document.getElementById('donutLocked');
  const donutUnlockedEl = document.getElementById('donutUnlocked');



  // 2) Get how many friends invited
  const friendsInvited = userState?.friendsInvited || 0;

  // 3) If friendsInvited >= 3, show unlocked; otherwise show locked
  if (friendsInvited >= 3) {
    
    bunchofcookiesLockedEl.style.display = 'none';


  } else {
    
    bunchofcookiesUnlockedEl.style.display = 'none';

  }

  
  if (friendsInvited >= 5) {
    
    candyLockedEl.style.display = 'none';

  } else {
    
    candyUnlockedEl.style.display = 'none';

  }

  
  if (friendsInvited >= 10) {
    
    donutLockedEl.style.display = 'none';

  } else {
    
    donutUnlockedEl.style.display = 'none';
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

  const totalBTC  = userState.totalBTC  || 0;
  const totalUSDT = userState.totalUSDT || 0;
  const totalTON  = userState.totalTON  || 0;


  //Bonuses tab
  document.getElementById('friendsInvitedCount').textContent = friendsInvited;
  
  // Store tab
  document.getElementById('storeCookieBalances').textContent = 
  `🍪 ${cookiesOwned} | 💣 ${bombs}`;


  // Balance tab
  //document.getElementById('cookieLine').textContent = 
   // `Cookies: ${cookiesOwned} | Choc: ${choc}`;

    // Update the cluster heading if we want to see it reflect changes immediately
  document.getElementById('clusterCookies').textContent = cookiesOwned;
  //document.getElementById('clusterChocolate').textContent = choc;
   document.getElementById('clusterBombs').textContent = bombs;


   //UNLOCK BUY BUTTONS FOR SPECIAL ITEMS DEPENDENT ON INVITED FRIEND COUNT
    //const chocBtn = document.getElementById("buyChocCookieBtn");

    // 2) If userState.friendsInvited < 3 => still locked
    if ((friendsInvited ?? 0) < 1) {
      //chocBtn.disabled = true;
      //chocBtn.textContent = "Locked 🍫"; // Or "Invite 3 friends first!"
      // Also, you can set a .locked style:
      //chocBtn.classList.add("locked");

    } else {
      // Unlocked
      //chocBtn.disabled = false;
      //chocBtn.textContent = "Buy 🍫";
      //chocBtn.classList.remove("locked");
    }

    //UPDATE FRIENDS-INVITE PROGRESS

    //STORE TAB
    updateInviteProgress('bunchofcookiesLockedProgress', 3);
    updateInviteProgress('candyLockedProgress', 5);
    updateInviteProgress('donutLockedProgress', 10);
    updateInviteProgress('pawLockedProgress', 12);

    //BONUSES TAB

    updateInviteProgress('bunchofcookiesBonusesProgress', 3);
    updateInviteProgress('candyBonusesProgress', 5);
    updateInviteProgress('donutBonusesProgress', 10);
    updateInviteProgress('pawBonusesProgress', 12);
    updateInviteProgress('freeCookieProgress', 5);
    




  //  // Show or hide the Bomb button
  const bombBtn = document.getElementById('useBombButton');
  if (bombBtn) {
    bombBtn.style.display = (bombs > 0) ? 'inline-block' : 'none';
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


  const totalBonusRate = calculateTotalBonusFromUserState();
  const bonusPercent = (totalBonusRate * 100).toFixed(1);
  document.getElementById("playerFeeds").textContent =
  `Total Feeds: ${userState.totalFeeds} (Bonus: +${bonusPercent}%)`;




  updateStoreItemsUI();

  //document.getElementById('statsBalances').innerHTML =
  //  `₿ BTC: ${totalBTC.toFixed(2)} (~$${(totalBTC * 100000).toFixed(2)}) <br>`
  //  + `💵 USDT: ${totalUSDT.toFixed(2)} (~$${(totalUSDT).toFixed(2)}) <br>`
  //  + `💎 TON: ${totalTON.toFixed(2)} (~$${(totalTON * 6).toFixed(2)})`;
}




function openChannelLink() {
  // Replace with your actual Telegram channel link
  const channelUrl = "https://t.me/LuckyChonk";
  window.open(channelUrl, "_blank");
}





//UPDATING LOCKED STORE ITEMS

function updateChocBarProgress() { //NOT IN USE CURRENTLY
  // Suppose userState.friendsInvited stores how many friends the user has invited
  const friendsInvited = userState?.friendsInvited || 0;
  const needed = 3; // number of invites required
  const percent = Math.min((friendsInvited / needed) * 100, 100);

  const bar = document.getElementById('chocBarUnlockProgress');
  if (bar) {
    bar.style.width = percent + '%';
  }
}

function updateInviteProgress(barId, needed) {
  const friendsInvited = userState?.friendsInvited || 0;
  const bar = document.getElementById(barId);
  if (!bar) return;

  const pct = Math.min((friendsInvited / needed) * 100, 100);
  bar.style.width = pct + '%';
}



function calculateTotalBonusFromUserState() {
  let total = 0;

  // Sum permanent
  const perm = userState.bonuses?.permanentItems || [];
  for (const item of perm) {
    total += (item.rate || 0);
  }

  // Filter & sum temporary
  const tmp = userState.bonuses?.temporaryItems || [];
  const now = Date.now();
  for (const item of tmp) {
    if (new Date(item.expiresAt).getTime() > now) {
      total += (item.rate || 0);
    }
  }

  return total; // e.g. 0.15 => 15%
}




/************************************************************
 * Check if user is following our channel
 ************************************************************/

async function checkChannelJoin() {
  try {
    const res = await fetch(`${BASE_API_URL}/api/checkChannelMembership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg.initData,
        userId: userId
      })
    });
    const data = await res.json();
    if (data.error) {
      console.error("checkChannelMembership error:", data.error);
      return;
    }

    // We will update the channelRewardStatus here
    const statusEl = document.getElementById("channelRewardStatus");

    if (data.isMember) {
      // If user just got the cookie, maybe do confetti or a small toast
      // e.g. if (!data.alreadyAwarded) shoot();

      // Update local userState
      userState.followsChannel       = true;
      userState.channelCookieAwarded = data.alreadyAwarded; 
      userState.cookiesOwned         = data.cookiesOwned;

      // Show a green check
      statusEl.textContent = "✅";
      statusEl.style.color = "#4CAF50";

      // Hide the cookie image
      const cookieImg = document.getElementById("channelCookieImage");
      if (cookieImg) cookieImg.style.display = "none";

    } else {
      // Not following
      userState.followsChannel = false;

      // Show a red cross
      statusEl.textContent = "❌";
      statusEl.style.color = "#f44336";
    }

    // Update local cookie count etc.
    updateBalances();
  } catch (err) {
    console.error("Request failed:", err);
  }
}




/************************************************************
 * 9) Feeding / Chonk Level (local display)
 ************************************************************/
const LEVEL_THRESHOLDS = [10, 50, 99, 200, 500, 600, 700];
const LEVEL_BONUSES = [0.0, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45];

function getChonkLevel(feeds) {
  let level = 0; // default
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (feeds >= LEVEL_THRESHOLDS[i]) {
      // each threshold we cross increases level by 1
      level = i + 1;
    } else {
      break; // stop once we fail to cross a threshold
    }
  }
  return level;
}

function getNextThreshold(level) {
  // If level=7 => we already surpassed the 700 feeds milestone
  if (level >= LEVEL_THRESHOLDS.length) {
    return null;
  }
  return LEVEL_THRESHOLDS[level]; 
}

function updateFeedingProgress() {
  if (!userState) return;

  const totalFeeds = userState.totalFeeds || 0;
  const level = getChonkLevel(totalFeeds);

  document.getElementById('totalFeeds').textContent = totalFeeds;
  document.getElementById('chonkLevel').textContent = level;

  // Current bonus
  const currentBonusDecimal = LEVEL_BONUSES[level] || 0.0; // e.g. 0.15 => "0.15%"
  const currentBonusPct = (currentBonusDecimal).toFixed(2) + "%";
  document.getElementById('chonkBonus').textContent = currentBonusPct;

  // Next threshold & progress
  const nextThresholdRewardEl = document.getElementById('nextLevelReward');
  const feedingProgress = document.getElementById('feedingProgress');
  const nextThreshold = getNextThreshold(level);

  if (nextThreshold === null) {
    // Already at max level (level=7)
    feedingProgress.style.width = "100%";
    nextThresholdRewardEl.textContent = "Max level reached";
    return;
  }

  // Current “base” threshold is the one we last crossed 
  // (or zero if none).
  let currentBase = 0;
  if (level > 0) {
    currentBase = LEVEL_THRESHOLDS[level - 1];
  }

  const required = nextThreshold - currentBase;    // how many feeds from one threshold to the next
  let achieved = totalFeeds - currentBase;         // how many we’ve gotten past currentBase
  if (achieved < 0) achieved = 0;
  if (achieved > required) achieved = required;    // clamp
  
  const percent = (achieved / required) * 100;
  feedingProgress.style.width = percent + "%";

  // Next level’s bonus 
  const nextLevel = level + 1;
  if (nextLevel >= LEVEL_BONUSES.length) {
    // e.g. nextLevel=8, but we only have 0..7
    nextThresholdRewardEl.textContent = "Max level reached";
  } else {
    const nextBonusDecimal = LEVEL_BONUSES[nextLevel];
    const nextBonusPct = (nextBonusDecimal).toFixed(2) + "%";
    nextThresholdRewardEl.textContent = nextBonusPct + " at " + nextThreshold + " feeds";
  }
}


/************************************************************
 * 10) ANALYTICS
 ************************************************************/
async function logUserEvent(eventName) {
  try {
    const res = await fetch(`${BASE_API_URL}/api/logUserEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData, // important for server validation
        eventName
      })
    });
    // No particular response needed — but you could check res.json() if desired
  } catch (err) {
    console.error("Error logging user event:", err);
  }
}

async function logStoreOpened() {
  try {
    await fetch(`${BASE_API_URL}/api/logConversionEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        eventName: 'store_opened'
      })
    });
  } catch (err) {
    console.error('logStoreOpened error:', err);
  }
}

/************************************************************
 * 11) Popup & Confetti
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


//BONUS LOGIC

function showFreeCookiePopup() {
  // Display the popup overlay
  document.getElementById("freeCookiePopup").style.display = "flex";

  // Fire confetti
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
}

function closeFreeCookiePopup() {
  document.getElementById("freeCookiePopup").style.display = "none";
}



/////TON WALLET


// Create a connector
    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://experiments.services.fluffychonk.com/chonk/tonconnect-manifest.json',
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
    const res = await fetch(`${BASE_API_URL}/api/updateWallet`, {
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
    const res = await fetch(`${BASE_API_URL}/api/leaderboard`);
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



