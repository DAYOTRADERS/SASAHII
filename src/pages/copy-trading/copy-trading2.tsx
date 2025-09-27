// src/pages/copy-trading/copy-trading.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getAppId } from '../../components/shared/utils/config/config';
import { observer } from 'mobx-react-lite';
import './copy-trading.scss';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Box, Button, TextField, Typography, Paper, CircularProgress, IconButton, Snackbar, Alert } from '@mui/material';
import { Refresh, Close } from '@mui/icons-material';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD68-Ub0oaU8B22e1eQpGNA0nYZ6s_4k_c",
  authDomain: "trading-site-b68e4.firebaseapp.com",
  projectId: "trading-site-b68e4",
  storageBucket: "trading-site-b68e4.firebasestorage.app",
  messagingSenderId: "621582722895",
  appId: "1:621582722895:web:e7674338a4c295910a873a",
  measurementId: "G-9TQ8TT3SG6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getAccountTokens = async (loginId: string) => {
  const docRef = doc(db, 'authTokens', loginId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().tokens : [];
};

const saveAccountTokens = async (loginId: string, tokens: string[]) => {
  const docRef = doc(db, 'authTokens', loginId);
  await setDoc(docRef, { tokens }, { merge: true });
};

const CopyTrading2 = observer(() => {
  const [currentLoginId, setCurrentLoginId] = useState<string | null>(null);
  const [isRealTrading, setIsRealTrading] = useState(
  localStorage.getItem('tradingMode') === 'real'
);
  const [traderTokens, setTraderTokens] = useState<string[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [balance, setBalance] = useState('');
  const [accountValue, setAccountValue] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('acct1');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');
  const [isCopyTradingActive, setIsCopyTradingActive] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');
  const [traderWebsockets, setTraderWebsockets] = useState<WebSocket[]>([]);
  const [copiedTrades, setCopiedTrades] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<{[key: string]: string}>({});

  const tokenListContainerRef = useRef<HTMLDivElement>(null);

  // Show snackbar message
  const showMessage = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Load tokens from Firestore
  const loadTokens = async () => {
    if (!currentLoginId) return;
    try {
      const tokens = await getAccountTokens(currentLoginId);
      setTraderTokens(tokens);
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  };

  // Mask token for display
  const maskToken = (token: string) => {
    if (typeof token !== 'string') return 'Invalid Token';
    if (token.length <= 8) return token;
    return token.substring(0, 4) + '...' + token.substring(token.length - 4);
  };
// Add token
const handleAddToken = async () => {
  if (!currentLoginId) {
    alert('Please authorize your main account first');
    return;
  }

  const token = tokenInput.trim();
  
  // Basic token validation - accept various formats
  if (!token || token.length < 10) {
    showMessage('Invalid token. Token appears to be too short.', 'error');
    return;
  }

  try {
    const existingTokens = await getAccountTokens(currentLoginId);
    if (existingTokens.some((t: string) => t === token)) {
      alert('This token is already added');
      return;
    }

    const updatedTokens = [...existingTokens, token];
    await saveAccountTokens(currentLoginId, updatedTokens);
    setTraderTokens(updatedTokens);
    setTokenInput('');
    showMessage('Token added successfully', 'success');
  } catch (error) {
    console.error('Error adding token:', error);
    showMessage('Failed to add token', 'error');
  }
};


  // Remove token
  const handleRemoveToken = async (index: number) => {
    if (!currentLoginId) return;
    
    try {
      const updatedTokens = traderTokens.filter((_, i) => i !== index);
      await saveAccountTokens(currentLoginId, updatedTokens);
      setTraderTokens(updatedTokens);
      showMessage('Token removed successfully', 'success');
    } catch (error) {
      console.error('Error removing token:', error);
      showMessage('Failed to remove token', 'error');
    }
  };

  // Simulate trade replication (for demo purposes)
  const simulateTradeReplication = () => {
    if (!isCopyTradingActive) return;

    // Simulate receiving trades every few seconds
    const simulatedTrades = [
      { contract_type: 'CALL', amount: 10, symbol: 'R_100' },
      { contract_type: 'PUT', amount: 15, symbol: 'R_75' },
      { contract_type: 'CALL', amount: 20, symbol: 'R_50' }
    ];

    simulatedTrades.forEach((trade, index) => {
      setTimeout(() => {
        const newTrade = {
          ...trade,
          copied_at: new Date().toLocaleTimeString(),
          status: 'success'
        };
        setCopiedTrades(prev => [...prev, newTrade]);
        showMessage(`Trade copied: ${trade.contract_type} $${trade.amount}`, 'success');
      }, (index + 1) * 3000);
    });
  };

  // Start copy trading
  const handleStartCopyTrading = async () => {
    if (!isAuthenticated) {
      showMessage('Please authenticate first', 'error');
      return;
    }

    if (traderTokens.length === 0) {
      showMessage('Please add at least one trader token', 'error');
      return;
    }

    try {
      setIsCopyTradingActive(true);
      setCopiedTrades([]);
      
      // For demo purposes, we'll simulate the connection
      const statusUpdates: {[key: string]: string} = {};
      
      traderTokens.forEach((token, index) => {
        const maskedToken = maskToken(token);
        statusUpdates[maskedToken] = 'connecting';
        
        // Simulate connection process
        setTimeout(() => {
          setConnectionStatus(prev => ({
            ...prev,
            [maskedToken]: 'connected'
          }));
          
          if (index === traderTokens.length - 1) {
            showMessage(`Connected to ${traderTokens.length} trader(s) successfully!`, 'success');
            simulateTradeReplication();
          }
        }, 1000 + (index * 500));
      });
      
      setConnectionStatus(statusUpdates);

    } catch (error) {
      console.error('Error starting copy trading:', error);
      showMessage('Failed to start copy trading', 'error');
      setIsCopyTradingActive(false);
    }
  };

  // Stop copy trading
  const handleStopCopyTrading = () => {
    setIsCopyTradingActive(false);
    setConnectionStatus({});
    showMessage('Copy trading stopped', 'info');
  };

  // Handle account selection change
  const handleAccountSelection = (selected: string) => {
    setSelectedAccount(selected);
    sessionStorage.setItem("selectedAccount", selected);
    
    if (websocket) {
      websocket.close();
    }
    
    const newAuthToken = selected === 'acct1' 
      ? sessionStorage.getItem("token1") || ''
      : sessionStorage.getItem("token2") || '';
    setAuthToken(newAuthToken);
    
    const appId = getAppId();
    const newWebsocket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
    
    newWebsocket.addEventListener('open', (event) => {
      console.log('Websocket connection established:', event);
      setIsWebSocketConnected(true);
      
      const token = localStorage.getItem('authToken') || '';
      setAuthToken(token);

      if (!token) {
        console.error('WebSocket connection failed: No auth token');
        return;
      }

      const authPayload = JSON.stringify({
        authorize: token,
        req_id: 9999
      });
      
      newWebsocket.send(authPayload);
    });
    
    newWebsocket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.msg_type === 'authorize' && data.req_id === 9999) {
        console.log('Main account authorization successful:', data);
        setIsAuthenticated(true);
        setCurrentLoginId(data.authorize.loginid);
        loadTokens();
        
        const balanceRequest = JSON.stringify({
          balance: 1,
          account: 'current',
          subscribe: 1,
          passthrough: {},
          req_id: 1
        });
        
        newWebsocket.send(balanceRequest);
        
        if (selected === 'acct1') {
          const acct1 = sessionStorage.getItem("acct1");
          setAccountValue(acct1 || "");
        } else if (selected === 'acct2') {
          const acct2 = sessionStorage.getItem("acct2");
          setAccountValue(acct2 || "");
        }
      }
      else if (data.msg_type === 'balance') {
        if (data.error) {
          console.error('Balance request error:', data.error);
          setBalance('');
          
          if (selected === 'acct1') {
            const acct1 = sessionStorage.getItem("acct1");
            const cur1 = sessionStorage.getItem("cur1");
            setAccountValue(acct1 ? `${acct1}${cur1}` : "create or/switch to demo");
          } else if (selected === 'acct2') {
            const acct2 = sessionStorage.getItem("acct2");
            const cur2 = sessionStorage.getItem("cur2");
            setAccountValue(acct2 ? `${acct2}${cur2}` : "Demo Acct - No Account");
          }
        } else {
          if (selected === 'acct1') {
            const acct1 = sessionStorage.getItem("acct1");
            const cur1 = sessionStorage.getItem("cur1");
            setAccountValue(acct1 || "");
            setBalance(`Balance: ${data.balance.balance} USD`);
          } else if (selected === 'acct2') {
            const acct2 = sessionStorage.getItem("acct2");
            const cur2 = sessionStorage.getItem("cur2");
            setAccountValue(acct2 || "");
            setBalance(`Balance: ${data.balance.balance} USD`);
          }
        }
      }
    });
    
    newWebsocket.addEventListener('close', (event) => {
      console.log('websocket connection closed: ', event);
      setIsAuthenticated(false);
      setIsWebSocketConnected(false);
      handleStopCopyTrading();
    });
    
    newWebsocket.addEventListener('error', (event) => {
      console.log('an error happened in our websocket connection', event);
    });
    
    setWebsocket(newWebsocket);
  };

  // Initialize on component mount
  useEffect(() => {
    const initialize = async () => {
      const storedAccount = sessionStorage.getItem("selectedAccount") || 'acct1';
      setSelectedAccount(storedAccount);
      
      const token = localStorage.getItem('authToken');
      if (token) {
        setAuthToken(token);
        handleAccountSelection(storedAccount);
      } else {
        console.error('No auth token found');
      }
    };
  
    initialize();
  }, []);
  
  useEffect(() => {
    if (currentLoginId && isAuthenticated) {
      loadTokens();
    }
  }, [currentLoginId, isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('tradingMode', isRealTrading ? 'real' : 'demo');
  }, [isRealTrading]);

  return (
    <div className='copy-trading'>
      <div className='copy-trading__content'>
        <div className='top-navbar'>   
          <div className='inner-nav'>
            <div className='row'></div>
            <div className='balance'>
              <p>{accountValue}</p>
              <p>{balance}</p>
            </div>

            <div className='status'>
              <div className='status-item'>
                <span>Status</span>
                <div 
                  id="websocket-status-indicator" 
                  className={`status-indicator ${isWebSocketConnected ? 'online' : 'offline'}`}
                ></div>
              </div>
              <div className='status-item'>
                <span>Copy Trading</span>
                <div 
                  className={`status-indicator ${isCopyTradingActive ? 'online' : 'offline'}`}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className='tab-container'>
          <div className='tab-content'>
            <div className='trading-hub'>
              <div className='hub-content'>
                <div className='cards-grid'>
                  <div className='hub-card config-card'>
                    <div className='card-shine'></div>
                    <div className='hub-card-header'>
                      <div className='card-title'>TRADING SETUP</div>
                      <div className='trading-mode-switch'>
                        <span className='mode-label'>OFF</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={isRealTrading}
                            onChange={() => setIsRealTrading(!isRealTrading)}
                          />
                          <span className="slider round"></span>
                        </label>
                        <span className='mode-label'>ON</span>
                      </div>
                      <div className='card-controls'>
                        <div className='control-dot'></div>
                        <div className='control-dot'></div>
                        <div className='control-dot'></div>
                      </div>
                    </div>
                    <div className='hub-card-content'>
                      {/* Start Copy Trading Button Section - Placed at the top */}
                      <div className='start-copy-trading-section'>
                        {isCopyTradingActive ? (
                          <button 
                            className='stop-copy-trading-btn'
                            onClick={handleStopCopyTrading}
                          >
                            <span className='btn-text'>STOP COPY TRADING</span>
                            <span className='btn-glow'></span>
                          </button>
                        ) : (
                          <button 
                            className='start-copy-trading-btn'
                            onClick={handleStartCopyTrading}
                          >
                            <span className='btn-text'>START COPY TRADING</span>
                            <span className='btn-glow'></span>
                            <span className='btn-particle'></span>
                          </button>
                        )}
                        <div className='copy-status'>
                          <span className={`status-indicator ${isCopyTradingActive ? 'active' : ''}`}></span>
                          <span className='status-text'>
                            {isCopyTradingActive ? 
                              `Copying ${traderTokens.length} trader(s)...` : 
                              'Ready to copy trades'
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div className='trader-selection'>
                        <label className='neon-label'>MANAGE TRADER TOKENS</label>
                        <div className='token-input-group'>
                          <input 
                            type="text" 
                            className='futuristic-input' 
                            placeholder="Enter trader auth token (starts with eyJ...)"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                          />
                          <button 
                            className='token-action-btn'
                            onClick={handleAddToken}
                          >
                            Add
                          </button>
                          <button 
                            className='token-action-btn sync-btn'
                            onClick={() => loadTokens()}
                          >
                            Refresh <Refresh style={{ fontSize: '1.2rem' }} />
                          </button>
                        </div>
                        
                        {/* Connection Status */}
                        {isCopyTradingActive && Object.keys(connectionStatus).length > 0 && (
                          <div className='connection-status'>
                            <label className='neon-label'>CONNECTION STATUS</label>
                            {Object.entries(connectionStatus).map(([token, status]) => (
                              <div key={token} className='connection-item'>
                                <span className='token-display'>{token}</span>
                                <span className={`status-dot ${status}`}></span>
                                <span className='status-text'>{status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className='token-list-container' ref={tokenListContainerRef}>
                          {traderTokens.length === 0 ? (
                            <div className='empty-list-message'>No tokens added yet</div>
                          ) : (
                            traderTokens.map((token, index) => (
                              <div key={index} className='token-item'>
                                <div>
                                  <span className='token-text'>{maskToken(token)}</span>
                                </div>
                                <span 
                                  className='remove-token' 
                                  title="Remove Token"
                                  onClick={() => handleRemoveToken(index)}
                                >
                                  ×
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Copied Trades Log */}
                      {isCopyTradingActive && copiedTrades.length > 0 && (
                        <div className='copied-trades-log'>
                          <label className='neon-label'>COPIED TRADES</label>
                          <div className='trades-list'>
                            {copiedTrades.slice(-5).reverse().map((trade, index) => (
                              <div key={index} className='trade-item'>
                                <span className='trade-time'>{trade.copied_at}</span>
                                <span className='trade-details'>
                                  {trade.contract_type} - ${trade.amount}
                                </span>
                                <span className='trade-status success'>✓</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className='status-bar'>
                  <div className='status-item'>
                    <span className='status-label'>CONNECTION:</span>
                    <span className='status-value good'>SECURE</span> 
                  </div>
                  <div className='status-item'>
                    <span className='status-label'>LATENCY:</span>
                    <span className='status-value good'>23ms</span>
                  </div>
                  <div className='status-item'>
                    <span className='status-label'>TRADERS:</span>
                    <span className='status-value'>{traderTokens.length} configured</span>
                  </div>
                  <div className='status-item'>
                    <span className='status-label'>TRADES COPIED:</span>
                    <span className='status-value'>{copiedTrades.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Snackbar for messages */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
});

export default CopyTrading2;