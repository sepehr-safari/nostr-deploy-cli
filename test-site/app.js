// Nostr Deploy Test Site JavaScript
console.log('🚀 Nostr Deploy Test Site Loaded!');

// Add some interactivity to demonstrate JS deployment
document.addEventListener('DOMContentLoaded', function () {
  // Add a timestamp to show when the page was loaded
  const timestamp = new Date().toLocaleString();

  // Create info box
  const infoBox = document.createElement('div');
  infoBox.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-size: 12px;
        z-index: 1000;
        max-width: 200px;
    `;

  infoBox.innerHTML = `
        <strong>Deployment Info</strong><br>
        Loaded: ${timestamp}<br>
        Protocol: Nostr + Blossom<br>
        Status: ✅ Active
    `;

  document.body.appendChild(infoBox);

  // Add click handler to header
  const header = document.querySelector('header h1');
  if (header) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', function () {
      alert(
        '🎉 This site is deployed on decentralized infrastructure using Nostr and Blossom protocols!'
      );
    });
  }

  // Animate list items
  const listItems = document.querySelectorAll('li');
  listItems.forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-20px)';
    item.style.transition = 'all 0.5s ease';

    setTimeout(() => {
      item.style.opacity = '1';
      item.style.transform = 'translateX(0)';
    }, index * 200);
  });
});

// Test console output
console.log('📡 Nostr Deploy CLI - Revolutionizing web deployment');
console.log('🔗 Decentralized • 🚀 Fast • 🔒 Secure');
