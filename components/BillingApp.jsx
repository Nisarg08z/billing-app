'use client';
import { useEffect } from 'react';
import { startApp } from '@/lib/client/app';

// SVG icon with the app's stroke style
const I = ({ d, w = 2, children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const v = i => ({ '--i': i });

// The page markup is rendered once by React; lib/client/app.js then drives it (same screens, gestures and motion as the phone app)
export default function BillingApp({ initial }) {
  useEffect(() => { startApp(initial); }, [initial]);
  const name = 'Bapa Sitaram'.split('');
  return (
    <>
      {/* Opening animation: plays on every launch, tap to skip */}
      <div id="intro" aria-hidden="true">
        <div className="intro-inner">
          <svg className="intro-logo" viewBox="0 0 120 120">
            <defs><linearGradient id="introGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d08f" /><stop offset="1" stopColor="#a9772c" /></linearGradient></defs>
            <circle className="ring" cx="60" cy="60" r="38" />
            <circle className="dot" cx="60" cy="60" r="15" />
          </svg>
          <div className="intro-name">{name.map((c, i) => c === ' ' ? ' ' : <i key={i} style={{ '--d': i }}>{c}</i>)}</div>
          <div className="intro-rule" />
          <div className="intro-sub">Restaurant, Dhrangadhra</div>
        </div>
      </div>

      {/* Tables */}
      <section className="screen on" id="s-tables">
        <header className="appbar band">
          <div className="titles">
            <div className="eyebrow"><span id="greet">Good evening</span><span id="liveDot" className="live-dot" title="Updates from other phones appear instantly">Live</span></div>
            <h1 id="restName">Bapa Sitaram</h1>
          </div>
          <button className="chip-btn" id="quickTakeaway"><I d="M12 5v14M5 12h14" w={2.4} />Takeaway</button>
        </header>
        <div className="band">
          <div className="hero anim" style={v(0)}>
            <div className="label" id="heroLabel">Today&apos;s sales</div>
            <div className="big num" id="todayAmt">₹0</div>
            <div className="stats">
              <div><b className="num" id="stBills">0</b><span>Bills</span></div>
              <div><b className="num" id="stRunning">0</b><span>Running tables</span></div>
              <div><b className="num" id="stAvg">₹0</b><span>Average bill</span></div>
            </div>
          </div>
          <div className="sec-head anim" style={v(1)}>
            <h2>Tables <small id="tableCount" /></h2>
            <div className="seg small" id="tFilter">
              <span className="thumb" />
              <button data-f="all" className="on">All</button>
              <button data-f="busy">Running</button>
              <button data-f="free">Free</button>
            </div>
          </div>
          <div className="tgrid" id="tableGrid" />
        </div>
      </section>

      {/* Order */}
      <section className="screen" id="s-order">
        <header className="appbar band">
          <button className="icon-btn" id="backBtn" aria-label="Back to tables"><I d="M15 18l-6-6 6-6" w={2.2} /></button>
          <div className="titles">
            <h1 id="orderTitle">Table 1</h1>
            <div className="sub" id="orderSub">New order</div>
          </div>
        </header>
        <div className="order-layout">
          <div>
            <div className="band anim" style={v(0)}>
              <div className="search">
                <I><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></I>
                <input id="search" type="search" placeholder="Search dishes" autoComplete="off" />
              </div>
            </div>
            <div className="chips band anim" id="chips" style={v(1)} />
            <div className="mgrid band" id="menuGrid" />
          </div>
          <aside className="cart card" id="cartSide" />
        </div>
        <button className="cartbar hidden" id="cartBar">
          <span className="count num" id="cbCount">0</span>
          <span className="info"><small id="cbLabel">Current order</small><b className="num" id="cbTotal">₹0</b></span>
          <span className="go">View bill <I d="M9 6l6 6-6 6" w={2.4} /></span>
        </button>
      </section>

      {/* Bills */}
      <section className="screen" id="s-bills">
        <header className="appbar band">
          <div className="titles"><div className="eyebrow">Sales &amp; history</div><h1>Bills</h1></div>
          <input type="date" id="billDate" className="date-pill" aria-label="Choose date" />
        </header>
        <div className="wrap">
          <div className="hero anim" style={v(0)}>
            <div className="label" id="dayLabel">Today</div>
            <div className="big num" id="dayAmt">₹0</div>
            <div className="stats">
              <div><b className="num" id="dBills">0</b><span>Bills</span></div>
              <div><b className="num" id="dAvg">₹0</b><span>Average</span></div>
              <div><b className="num" id="dItems">0</b><span>Dishes sold</span></div>
            </div>
          </div>
          <div className="sec-head anim" style={v(1)}><h2>By payment</h2></div>
          <div className="pays" id="payStats" />
          <div id="topItemsWrap">
            <div className="sec-head anim" style={v(5)}><h2>Top dishes</h2></div>
            <div className="card list anim" style={v(6)} id="topItems" />
          </div>
          <div className="sec-head anim" style={v(7)}><h2>All bills <small id="billCount" /></h2>
            <button className="chip-btn" id="csvBtn"><I d="M12 3v12M7 10l5 5 5-5M5 21h14" />CSV</button>
          </div>
          <div className="card list anim" style={v(8)} id="billList" />
        </div>
      </section>

      {/* Settings */}
      <section className="screen" id="s-settings">
        <header className="appbar band">
          <div className="titles"><div className="eyebrow">Your restaurant</div><h1>Settings</h1></div>
        </header>
        <div className="wrap">
          <div className="sec-head anim" style={{ '--i': 0, marginTop: 8 }}><h2>Appearance</h2></div>
          <div className="card pad anim" style={v(1)}>
            <div className="seg" id="themeSeg" role="radiogroup" aria-label="Theme">
              <span className="thumb" />
              <button data-theme="system" role="radio" aria-checked="false"><I><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></I>System</button>
              <button data-theme="light" role="radio" aria-checked="false"><I><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>Light</button>
              <button data-theme="dark" role="radio" aria-checked="false"><I d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />Dark</button>
            </div>
            <p className="sec-note" style={{ margin: '10px 0 0' }}>Theme is set for this phone only. System follows your phone&apos;s light or dark setting.</p>
          </div>

          <div className="sec-head anim" style={v(4)}><h2>Menu <small id="dishCount" /></h2>
            <button className="chip-btn" id="addCatBtn"><I d="M12 5v14M5 12h14" w={2.2} />Category</button>
          </div>
          <p className="sec-note">Changes save as you type. Prices on saved bills don&apos;t change.</p>
          <div className="card anim" style={{ '--i': 5, marginBottom: 12 }}>
            <div className="cat-top"><b>Add a dish</b></div>
            <div className="add-row" style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
              <div className="row">
                <input id="newDish" placeholder="Dish name" />
                <div className="affix" style={{ flex: '0 0 120px' }}><input id="newPrice" type="number" inputMode="decimal" placeholder="Price" /><span>₹</span></div>
              </div>
              <div className="row">
                <select id="newCat" aria-label="Category" />
                <button className="btn dark" id="addDishBtn" style={{ height: 48 }}>Add dish</button>
              </div>
            </div>
          </div>
          <div id="menuEdit" />

          <div className="sec-head anim" style={v(6)}><h2>Tables <small id="tableCount2" /></h2></div>
          <div className="card anim" style={v(7)}>
            <div className="list" id="tableEdit" />
            <div className="add-row">
              <div className="row">
                <input id="newTable" placeholder="e.g. Table 7, Room 101" />
                <button className="btn dark" id="addTableBtn" style={{ height: 48, flex: '0 0 120px' }}>Add table</button>
              </div>
            </div>
          </div>
          <div className="sec-head anim" style={v(8)}><h2>UPI QR code</h2></div>
          <p className="sec-note">Shown to the customer when the bill is paid by UPI.</p>
          <div className="card pad anim" style={v(9)} id="qrBox" />
          <input type="file" id="qrFile" accept="image/png,image/jpeg,image/webp,image/*" className="hidden" />

          <div className="sec-head anim" style={v(10)}><h2>Password</h2></div>
          <p className="sec-note">Used to sign in on every phone. After a change, other phones must sign in again.</p>
          <div className="card anim" style={v(9)}>
            <form className="fields" id="pwForm" autoComplete="on">
              <input type="text" name="username" autoComplete="username" defaultValue="Bapa Sitaram" hidden readOnly />
              <div className="field"><label htmlFor="pwCur">Current password</label><input id="pwCur" type="password" autoComplete="current-password" /></div>
              <div className="row">
                <div className="field"><label htmlFor="pwNew">New password</label><input id="pwNew" type="password" autoComplete="new-password" /></div>
                <div className="field"><label htmlFor="pwNew2">Repeat new password</label><input id="pwNew2" type="password" autoComplete="new-password" /></div>
              </div>
              <button className="btn dark" id="pwBtn" style={{ height: 48, marginTop: 4 }}>Change password</button>
            </form>
          </div>
          <p className="footer-note"><b>Bapa Sitaram</b>Billing · version 4.0</p>
        </div>
      </section>

      <nav className="tabs" id="tabs">
        <span className="brand" aria-hidden="true"><svg viewBox="0 0 512 512"><circle cx="256" cy="256" r="150" fill="none" stroke="#f4efe6" strokeWidth="36" /><circle cx="256" cy="256" r="66" fill="#dcb56a" /></svg></span>
        <button data-tab="tables" className="on"><span className="ico"><I><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></I></span>Tables</button>
        <button data-tab="bills"><span className="ico"><I><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6M9 15h4" /></I></span>Bills</button>
        <button data-tab="settings"><span className="ico"><I><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></I></span>Settings</button>
      </nav>

      <div className="scrim" id="scrim" />
      <div className="sheet" id="sheet" role="dialog" aria-modal="true"><div className="grab" /><div id="sheetBody" /></div>
      <div className="toast" id="toast" role="status" />
      <div className="netbar" id="netbar" role="status">No internet · changes will sync</div>
    </>
  );
}
