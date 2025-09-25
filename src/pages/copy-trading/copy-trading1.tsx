// src/pages/copy-trading/copy-trading.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getAppId } from '../../components/shared/utils/config/config';
import { observer } from 'mobx-react-lite';
import './copy-trading.scss';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Box, Button, TextField, Typography, Paper, CircularProgress, IconButton } from '@mui/material';
import { Refresh, Close } from '@mui/icons-material';
// Add these at the top with other imports
import { updateDoc } from 'firebase/firestore';


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

// Add these utility functions right after Firebase initialization
const getAccountTokens = async (loginId: string) => {
  const docRef = doc(db, 'accountTokens', loginId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().tokens : [];
};

const saveAccountTokens = async (loginId: string, tokens: any[]) => {
  const docRef = doc(db, 'accountTokens', loginId);
  await setDoc(docRef, { tokens }, { merge: true });
};

const updateTokenStatus = async (loginId: string, token: string, status: string) => {
  const tokens = await getAccountTokens(loginId);
  const updatedTokens = tokens.map((t: { token: string; status: string }) => 
    t.token === token ? { ...t, status } : t
  );
  await saveAccountTokens(loginId, updatedTokens);
};

const CopyTrading1 = observer(() => {
  const [currentLoginId, setCurrentLoginId] = useState<string | null>(null);
  const [traderTokens, setTraderTokens] = useState<Array<{token: string, status: string}>>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [copyTradingStatus, setCopyTradingStatus] = useState({text: '', className: ''});
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [balance, setBalance] = useState('');
  const [accountValue, setAccountValue] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('acct1');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken') || '');  const [maxTradeStake, setMaxTradeStake] = useState('');
  const [minTradeStake, setMinTradeStake] = useState('');
  const [activeTab, setActiveTab] = useState('trader-list');
  const [tradersData, setTradersData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>({});
  
  const tokenListContainerRef = useRef<HTMLDivElement>(null);

  // Load tokens from Firestore
  const loadTokens = async () => {
    if (!currentLoginId) return;
  
    try {
      const tokens = await getAccountTokens(currentLoginId);
      setTraderTokens(tokens);
      
      // Verify any pending tokens
      tokens.forEach((tokenObj: { token: string; status: string }) => {
        if (tokenObj.status === 'pending') {
          const reqId = Date.now();
          websocket?.send(JSON.stringify({
            authorize: tokenObj.token,
            req_id: reqId
          }));
  
          const verifyHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'authorize' && data.req_id === reqId) {
              websocket?.removeEventListener('message', verifyHandler);
              const status = data.error ? 'error' : 'verified';
              updateTokenStatus(currentLoginId, tokenObj.token, status)
                .then(() => loadTokens()); // Refresh list
            }
          };
  
          websocket?.addEventListener('message', verifyHandler);
        }
      });
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
  };

  // Save tokens to Firestore
  const saveTokens = async () => {
    if (!currentLoginId) {
      alert('Please authorize your main account first');
      return false;
    }

    try {
      const docRef = doc(db, 'accountTokens', currentLoginId);
      await setDoc(docRef, { tokens: traderTokens }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error saving tokens:", error);
      return false;
    }
  };

  // Mask token for display
  const maskToken = (tokenObj: any) => {
    const token = typeof tokenObj === 'string' ? tokenObj : tokenObj.token;
    
    if (typeof token !== 'string') {
      console.error('Invalid token format:', tokenObj);
      return 'Invalid Token';
    }
    
    if (token.length <= 8) return token;
    return token.substring(0, 4) + '...' + token.substring(token.length - 4);
  };

  // Add token
  const handleAddToken = async () => {
    if (!currentLoginId || !websocket) {
      alert('Please authorize your main account first');
      return;
    }
  
    const token = tokenInput.trim();
    if (!token) return;
  
    try {
      // 1. First enable "Allow Copy Trading"
      await new Promise<void>((resolve, reject) => {
        const allowCopyReqId = Date.now();
        
        // Send allow copy request
        websocket.send(JSON.stringify({
          authorize: authToken,
          req_id: allowCopyReqId
        }));
  
        const allowCopyHandler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'authorize' && data.req_id === allowCopyReqId) {
            websocket.removeEventListener('message', allowCopyHandler);
            
            if (data.error) {
              reject(new Error('Authorization failed: ' + data.error.message));
              return;
            }
  
            // Now send the allow copiers setting
            websocket.send(JSON.stringify({
              set_settings: 1,
              allow_copiers: 1,
              req_id: allowCopyReqId + 1
            }));
  
            const settingsHandler = (event: MessageEvent) => {
              const settingsData = JSON.parse(event.data);
              if (settingsData.msg_type === 'set_settings' && settingsData.req_id === allowCopyReqId + 1) {
                websocket.removeEventListener('message', settingsHandler);
                
                if (settingsData.error) {
                  reject(new Error('Failed to allow copy trading: ' + settingsData.error.message));
                } else {
                  resolve();
                }
              }
            };
  
            websocket.addEventListener('message', settingsHandler);
          }
        };
  
        websocket.addEventListener('message', allowCopyHandler);
      });
  
      // 2. Proceed with adding token and starting copy trading
      const existingTokens = await getAccountTokens(currentLoginId);
      if (existingTokens.some((t: { token: string; status: string }) => t.token === token)) {
        alert('This token is already added');
        return;
      }
  
      // Add new token with pending status
      const newToken = { token, status: 'pending' };
      const updatedTokens = [...existingTokens, newToken];
      await saveAccountTokens(currentLoginId, updatedTokens);
      setTraderTokens(updatedTokens);
      setTokenInput('');
      setCopyTradingStatus({text: 'Starting copy trading...', className: 'pending'});
  
      // 3. Verify and start copy trading
      const reqId = Date.now();
      websocket.send(JSON.stringify({
        authorize: token,
        req_id: reqId
      }));
  
      // Wait for verification
      await new Promise<void>((resolve, reject) => {
        const verifyHandler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'authorize' && data.req_id === reqId) {
            websocket.removeEventListener('message', verifyHandler);
            
            if (data.error) {
              reject(new Error('Token verification failed: ' + data.error.message));
              return;
            }
            resolve();
          }
        };
        websocket.addEventListener('message', verifyHandler);
      });
  
      // 4. Start copy trading
      const copyStartReqId = reqId + 1;
      const copyStartRequest: any = {
        "copy_start": authToken,
        "req_id": copyStartReqId
      };
  
      if (maxTradeStake) copyStartRequest.max_trade_stake = Number(maxTradeStake);
      if (minTradeStake) copyStartRequest.min_trade_stake = Number(minTradeStake);
  
      websocket.send(JSON.stringify(copyStartRequest));
  
      // Wait for copy_start response
      await new Promise<void>((resolve, reject) => {
        const copyStartHandler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'copy_start' && data.req_id === copyStartReqId) {
            websocket.removeEventListener('message', copyStartHandler);
            
            if (data.error) {
              reject(new Error('Copy start failed: ' + data.error.message));
            } else {
              resolve();
            }
          }
        };
        websocket.addEventListener('message', copyStartHandler);
      });
  
      // 5. Update status
      await updateTokenStatus(currentLoginId, token, 'success');
      loadTokens();
      setCopyTradingStatus({text: 'Copy trading started successfully!', className: 'success'});
  
    } catch (error) {
      console.error('Error in add token process:', error);
      await updateTokenStatus(currentLoginId, token, 'error');
      setCopyTradingStatus({
        text: `Error: ${error instanceof Error ? error.message : 'Failed to start copy trading'}`,
        className: 'error'
      });
      loadTokens();
    }
  };

  const setupPingPong = (websocket: WebSocket) => {
    const PING_INTERVAL = 30000; // 30 seconds
    let pingInterval: NodeJS.Timeout;
    
    // Start sending pings
    const startPing = () => {
      pingInterval = setInterval(() => {
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ ping: 1 }));
        }
      }, PING_INTERVAL);
    };
  
    // Listen for pong responses
    const pongHandler = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (message.msg_type === 'pong') {
        console.log('Pong received - connection healthy');
      }
    };
  
    websocket.addEventListener('open', startPing);
    websocket.addEventListener('message', pongHandler);
    
    // Cleanup function
    return () => {
      clearInterval(pingInterval);
      websocket.removeEventListener('message', pongHandler);
      websocket.removeEventListener('open', startPing);
    };
  };

  // Remove token
  const handleRemoveToken = async (index: number) => {
    const tokenObj = traderTokens[index];
    if (!tokenObj || !websocket || !currentLoginId) return;
  
    
  
    setCopyTradingStatus({text: `Stopping copy trading for ${maskToken(tokenObj)}...`, className: 'pending'});
  
    try {
      // Step 1: Authorize the trader account
      const authReqId = Date.now();
      websocket.send(JSON.stringify({
        authorize: tokenObj.token,
        req_id: authReqId
      }));
  
      // Wait for authorization
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Authorization timeout')), 5000);
        
        const handler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'authorize' && data.req_id === authReqId) {
            clearTimeout(timeout);
            websocket?.removeEventListener('message', handler);
            data.error ? reject(data.error) : resolve(null);
          }
        };
        
        websocket.addEventListener('message', handler);
      });
  
      // Step 2: Send copy_stop
      const stopReqId = Date.now() + 1;
      websocket.send(JSON.stringify({
        copy_stop: authToken,
        req_id: stopReqId
      }));
  
      // Wait for copy_stop confirmation
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Copy stop timeout')), 5000);
        
        const handler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'copy_stop' && data.req_id === stopReqId) {
            clearTimeout(timeout);
            websocket?.removeEventListener('message', handler);
            data.error ? reject(data.error) : resolve(null);
          }
        };
        
        websocket.addEventListener('message', handler);
      });
  
      // Step 3: Remove from Firebase and state
      const updatedTokens = traderTokens.filter((_, i) => i !== index);
      await saveAccountTokens(currentLoginId, updatedTokens);
      setTraderTokens(updatedTokens);
      
      setCopyTradingStatus({
        text: `Successfully stopped copy trading for ${maskToken(tokenObj)}`,
        className: 'success'
      });
  
    } catch (error) {
      console.error('Error stopping copy trading:', error);
      setCopyTradingStatus({
        text: `Failed to stop copy trading: ${error instanceof Error ? error.message : String(error)}`,
        className: 'error'
      });
    }
  };

  // Start copy trading
  const handleStartCopyTrading = async () => {
    setCopyTradingStatus({text: 'Starting copy trading...', className: 'pending'});
    
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];
    
    for (let i = 0; i < traderTokens.length; i++) {
      const tokenObj = traderTokens[i];
      
      try {
        // Authorize first with specific req_id to identify trader token auth
        const authRequest = {
          "authorize": tokenObj.token,
          "req_id": 1000 + i
        };
        
        websocket?.send(JSON.stringify(authRequest));
        
        // Wait for auth response
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Authorization timeout'));
          }, 5000);
          
          const authHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'authorize' && data.req_id === 1000 + i) {
              clearTimeout(timeoutId);
              websocket?.removeEventListener('message', authHandler);
              
              if (data.error) {
                reject(new Error(data.error.message));
              } else {
                resolve(null);
              }
            }
          };
          
          websocket?.addEventListener('message', authHandler);
        });
        
        // Send copy_start request
        const request: any = {
          "copy_start": authToken,
          "req_id": 2000 + i
        };
        
        // Add optional parameters if provided
        if (maxTradeStake) {
          request.max_trade_stake = Number(maxTradeStake);
        }
        
        if (minTradeStake) {
          request.min_trade_stake = Number(minTradeStake);
        }
        
        // Wait for copy_start response
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Copy start timeout'));
          }, 5000);
          
          const copyStartHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'copy_start' && data.req_id === 2000 + i) {
              clearTimeout(timeoutId);
              websocket?.removeEventListener('message', copyStartHandler);
              
              if (data.error) {
                reject(new Error(data.error.message));
              } else {
                resolve(null);
              }
            }
          };
          
          websocket?.addEventListener('message', copyStartHandler);
          websocket?.send(JSON.stringify(request));
        });
        
        // Update token status
        const updatedTokens = [...traderTokens];
        updatedTokens[i] = {...updatedTokens[i], status: 'success'};
        setTraderTokens(updatedTokens);
        successCount++;
      } catch (error) {
        console.error(`Error starting copy trading for token ${i}:`, error);
        const updatedTokens = [...traderTokens];
        updatedTokens[i] = {...updatedTokens[i], status: 'error'};
        setTraderTokens(updatedTokens);
        errorCount++;
        errorMessages.push(`Token ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Update status messaging
    if (errorCount === 0) {
      setCopyTradingStatus({text: `Copy trading started successfully for all ${successCount} tokens!`, className: 'success'});
    } else {
      setCopyTradingStatus({text: `Copy trading failed for ${errorCount} tokens. Successful: ${successCount}. Errors: ${errorMessages.join('; ')}`, className: 'error'});
    }
    
    // Request updated list
    const requestList = {
      "copytrading_list": 1,
      "req_id": 100
    };
    websocket?.send(JSON.stringify(requestList));
  };

  // Stop copy trading
  const handleStopCopyTrading = async () => {
    setCopyTradingStatus({text: 'Stopping copy trading...', className: 'pending'});
    
    let successCount = 0;
    let errorCount = 0;
    let errorMessages: string[] = [];
    
    for (let i = 0; i < traderTokens.length; i++) {
      const tokenObj = traderTokens[i];
      
      try {
        // Authorize first with specific req_id
        const authRequest = {
          "authorize": tokenObj.token,
          "req_id": 1000 + i
        };
        
        websocket?.send(JSON.stringify(authRequest));
        
        // Wait for auth response
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Authorization timeout'));
          }, 5000);
          
          const authHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'authorize' && data.req_id === 1000 + i) {
              clearTimeout(timeoutId);
              websocket?.removeEventListener('message', authHandler);
              
              if (data.error) {
                reject(new Error(data.error.message));
              } else {
                resolve(null);
              }
            }
          };
          
          websocket?.addEventListener('message', authHandler);
        });
        
        // Send copy_stop request
        const request = {
          "copy_stop": authToken,
          "req_id": 3000 + i
        };
        
        // Wait for copy_stop response
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Copy stop timeout'));
          }, 5000);
          
          const copyStopHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'copy_stop' && data.req_id === 3000 + i) {
              clearTimeout(timeoutId);
              websocket?.removeEventListener('message', copyStopHandler);
              
              if (data.error) {
                reject(new Error(data.error.message));
              } else {
                resolve(null);
              }
            }
          };
          
          websocket?.addEventListener('message', copyStopHandler);
          websocket?.send(JSON.stringify(request));
        });
        
        // Reset token status
        const updatedTokens = [...traderTokens];
        updatedTokens[i] = {...updatedTokens[i], status: 'pending'};
        setTraderTokens(updatedTokens);
        successCount++;
      } catch (error) {
        console.error(`Error stopping copy trading for token ${i}:`, error);
        const updatedTokens = [...traderTokens];
        updatedTokens[i] = {...updatedTokens[i], status: 'error'};
        setTraderTokens(updatedTokens);
        errorCount++;
        errorMessages.push(`Token ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Update status messaging
    if (errorCount === 0) {
      setCopyTradingStatus({text: `Copy trading stopped successfully for all ${successCount} tokens!`, className: 'success'});
    } else {
      setCopyTradingStatus({text: `Copy trading stop failed for ${errorCount} tokens. Successful: ${successCount}. Errors: ${errorMessages.join('; ')}`, className: 'error'});
    }
    
    // Request updated list
    const requestList = {
      "copytrading_list": 1,
      "req_id": 100
    };
    websocket?.send(JSON.stringify(requestList));
  };

  // Allow copy
  const handleAllowCopy = () => {
    console.log("Allow Copy Clicked");
    
    // First, re-authorize the main account
    const authRequest = {
      authorize: authToken,
      req_id: 9998 // Use a unique req_id different from the main authorization
    };

    websocket?.send(JSON.stringify(authRequest));

    // Create a handler specifically for this authorization and subsequent settings
    const settingsHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      // Check if this is the response to our specific authorization
      if (data.msg_type === 'authorize' && data.req_id === 9998) {
        if (!data.error) {
          // Successfully re-authorized, now send settings request
          const settingsRequest = {
            set_settings: 1,
            allow_copiers: 1
          };

          websocket?.send(JSON.stringify(settingsRequest));
        } else {
          console.error('Authorization failed:', data.error);
        }

        // Remove this event listener after processing
        websocket?.removeEventListener('message', settingsHandler);
      }
    };

    // Add the event listener for handling the authorization and subsequent request
    websocket?.addEventListener('message', settingsHandler);
  };

  // Disallow copy
  const handleDisallowCopy = () => {
    console.log("Disallow Copy Clicked");
    
    // First, re-authorize the main account
    const authRequest = {
      authorize: authToken,
      req_id: 9997 // Use a unique req_id different from the main authorization
    };

    websocket?.send(JSON.stringify(authRequest));

    // Create a handler specifically for this authorization and subsequent settings
    const settingsHandler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      // Check if this is the response to our specific authorization
      if (data.msg_type === 'authorize' && data.req_id === 9997) {
        if (!data.error) {
          // Successfully re-authorized, now send settings request
          const settingsRequest = {
            set_settings: 1,
            allow_copiers: 0
          };

          websocket?.send(JSON.stringify(settingsRequest));
        } else {
          console.error('Authorization failed:', data.error);
        }

        // Remove this event listener after processing
        websocket?.removeEventListener('message', settingsHandler);
      }
    };

    // Add the event listener for handling the authorization and subsequent request
    websocket?.addEventListener('message', settingsHandler);
  };

  // Handle account selection change
  const handleAccountSelection = (selected: string) => {
    setSelectedAccount(selected);
    sessionStorage.setItem("selectedAccount", selected);
    
    if (websocket) {
      websocket.close();
    }
    
    // Open a new websocket connection with the respective auth token
    const newAuthToken = selected === 'acct1' 
      ? sessionStorage.getItem("token1") || ''
      : sessionStorage.getItem("token2") || '';
    setAuthToken(newAuthToken);
    
    // First import your getAppId function at the top of your file

// Then use it when creating the WebSocket
const appId = getAppId(); // This will get the stored or computed app_id
const newWebsocket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);    const cleanupPingPong = setupPingPong(newWebsocket);

    
    newWebsocket.addEventListener('open', (event) => {
      console.log('Websocket connection established:', event);
      setIsWebSocketConnected(true);
      
      // Always get fresh token from localStorage
const token = localStorage.getItem('authToken') || '';
setAuthToken(token); // Keep React state in sync

if (!token) {
  console.error('WebSocket connection failed: No auth token');
  return; // Handle error appropriately
}

const authPayload = JSON.stringify({
  authorize: token, // Use verified token
  req_id: 9999
});
      
      newWebsocket.send(authPayload);
    });
    
    newWebsocket.addEventListener('message', (event) => {
      const receivedMessage = JSON.parse(event.data);
      const data = JSON.parse(event.data);
      
      // Handle main account authorization (req_id: 9999)
      if (data.msg_type === 'authorize' && data.req_id === 9999) {
        console.log('Main account authorization successful:', receivedMessage);
        setIsAuthenticated(true);
        setCurrentLoginId(data.authorize.loginid);
        // Debug before loading tokens
        console.log('Loading tokens for loginId:', data.authorize.loginid);
        setTimeout(() => loadTokens(), 0);
        
        // Send requests to retrieve copy trading list and statistics
        const requestList = {
          "copytrading_list": 1,
          "req_id": 1
        };
    
        const requestStats = {
          "copytrading_statistics": 1,
          "trader_id": "VRTC8609996", // Replace with actual trader ID
          "req_id": 2
        };
    
        newWebsocket.send(JSON.stringify(requestList));
        newWebsocket.send(JSON.stringify(requestStats));
        
        // Subscribe to stream for open contracts
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
      
      // Handle trader token authorization responses (req_id between 1000 and 1999)
      else if (data.msg_type === 'authorize' && data.req_id >= 1000 && data.req_id < 2000) {
        const tokenIndex = data.req_id - 1000;
        
        // Modify how we update the token status
        const updatedTokens = [...traderTokens];
        if (data.error) {
          console.error(`Trader authorization failed for token ${tokenIndex}:`, data.error);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'error'
          };
        } else {
          console.log(`Trader authorization successful for token ${tokenIndex}`);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'pending'
          };
        }
        
        setTraderTokens(updatedTokens);
      }
      
      // Handle copy_start responses (req_id between 2000 and 2999)
      if (data.msg_type === 'copy_start' && data.req_id >= 2000 && data.req_id < 3000) {
        const tokenIndex = data.req_id - 2000;
        
        const updatedTokens = [...traderTokens];
        if (data.error) {
          console.error(`Copy start failed for token ${tokenIndex}:`, data.error);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'error'
          };
        } else {
          console.log(`Copy trading started successfully for token ${tokenIndex}`);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'success'
          };
        }
        
        setTraderTokens(updatedTokens);
      }
      
      // Handle copy_stop responses (req_id between 3000 and 3999)
      if (data.msg_type === 'copy_stop' && data.req_id >= 3000 && data.req_id < 4000) {
        const tokenIndex = data.req_id - 3000;
        
        const updatedTokens = [...traderTokens];
        if (data.error) {
          console.error(`Copy stop failed for token ${tokenIndex}:`, data.error);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'error'
          };
        } else {
          console.log(`Copy trading stopped successfully for token ${tokenIndex}`);
          updatedTokens[tokenIndex] = {
            ...updatedTokens[tokenIndex],
            status: 'pending'
          };
        }
        
        setTraderTokens(updatedTokens);
      }

      // Handling the copytrading_list message
      if (data.msg_type === "copytrading_list" && data.req_id === 100) {
        setTradersData(data.copytrading_list.traders || []);
      }
    
      // Handling the copytrading_statistics message
      if (data.msg_type === "copytrading_statistics") {
        setStatsData(data.copytrading_statistics || {});
      }
      
      else if (receivedMessage.msg_type === 'balance') {
        if (receivedMessage.error) {
          console.error('Balance request error:', receivedMessage.error);
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
          // Handle balance response here
          if (selected === 'acct1') {
            const acct1 = sessionStorage.getItem("acct1");
            const cur1 = sessionStorage.getItem("cur1");
            setAccountValue(acct1 || "");
            setBalance(`Balance: ${receivedMessage.balance.balance} USD`);
          } else if (selected === 'acct2') {
            const acct2 = sessionStorage.getItem("acct2");
            const cur2 = sessionStorage.getItem("cur2");
            setAccountValue(acct2 || "");
            setBalance(`Balance: ${receivedMessage.balance.balance} USD`);
          }
        }
      }
      else {
        console.log('received message: ', receivedMessage);
      } 
    });
    
    newWebsocket.addEventListener('close', (event) => {
      cleanupPingPong(); // Clean up the ping interval

      console.log('websocket connection closed: ', event);
      setIsAuthenticated(false);
      setIsWebSocketConnected(false);
    });
    
    newWebsocket.addEventListener('error', (event) => {
      console.log('an error happened in our websocket connection', event);
    });
    
    setWebsocket(newWebsocket);
  };

  // Redirect to OAuth
  const redirectToOAuth = () => {
    const appId = "36300"; // Replace with your actual app ID
    const redirectUrl = encodeURIComponent("https://elitetestversion3.web.app/extract_token.html");
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirectUrl}`;
    window.location.href = oauthUrl;
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
  
  // Add this new useEffect
  useEffect(() => {
    if (currentLoginId && isAuthenticated) {
      loadTokens();
    }
  }, [currentLoginId, isAuthenticated]);

  useEffect(() => {
  // Runs on mount and when authToken becomes empty
  if (!authToken) {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setAuthToken(storedToken);
    } else {
      console.error('User not authenticated');
      // Optional: Redirect to login or show UI warning
      // navigate('/login');
    }
  }
}, [authToken]);

// Listen for storage changes (e.g., when token is updated)
useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        setAuthToken(e.newValue || '');
        // Optional: Reconnect WebSocket if token changed
      }
    };
  
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update time and date every minute
  useEffect(() => {
    const updateTimeAndDate = () => {
      const currentDateTime = new Date();
      const currentHours = currentDateTime.getHours();
      const currentMinutes = currentDateTime.getMinutes();
      const formattedTime = `${currentHours % 12 || 12}:${currentMinutes < 10 ? '0' + currentMinutes : currentMinutes} ${currentHours >= 12 ? 'PM' : 'AM'}`;
      const formattedDate = `${currentDateTime.getMonth() + 1}/${currentDateTime.getDate()}/${currentDateTime.getFullYear()}`;
    };

    const interval = setInterval(updateTimeAndDate, 60000);
    updateTimeAndDate();
    
    return () => clearInterval(interval);
  }, []);

  // Sync button handler
  const handleSync = () => {
    window.location.reload();
  };

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
            </div>

            
          </div>
        </div>

        <div className='tab-container'>
          <div className='tab-content'>
            <div className='trading-hub'>
              <div className='hub-content'>
                <div className='cards-grid'>
                  <div id="trading-options" className='hub-card config-card'>
                    <div className='card-shine'></div>
                    <div className='hub-card-header'>
                      <div className='card-title'>TRADING SETUP</div>
                      <div className='card-controls'>
                        <div className='control-dot'></div>
                        <div className='control-dot'></div>
                        <div className='control-dot'></div>
                      </div>
                    </div>
                    <div id="copy-trading-settings" className='hub-card-content'>
                      <div className='trader-selection'>
                        <label className='neon-label'>MANAGE TRADER TOKENS</label>
                        <div className='token-input-group'>
                          <input 
                            type="text" 
                            id="tokenInput" 
                            className='futuristic-input' 
                            placeholder="Enter trader auth token"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                          />
                          <button 
                            id="addTokenBtn" 
                            className='token-action-btn'
                            onClick={handleAddToken}
                          >
                            Add
                          </button>
                          <button 
                            id="syncBtn" 
                            className='token-action-btn sync-btn'
                            onClick={handleSync}
                          >
                            Reload <Refresh style={{ fontSize: '1.2rem' }} />
                          </button>
                        </div>
                        {copyTradingStatus.text && (
                          <p 
                            id="copy-trading-status" 
                            className={`copy-trading-status ${copyTradingStatus.className}`}
                          >
                            {copyTradingStatus.text}
                          </p>
                        )}
                        <div id="tokenListContainer" className='token-list-container' ref={tokenListContainerRef}>
                          {traderTokens.length === 0 ? (
                            <div className='empty-list-message'>No tokens added yet</div>
                          ) : (
                            traderTokens.map((tokenObj, index) => (
                              <div key={index} className='token-item'>
                                <div>
                                  <span className='token-text'>{maskToken(tokenObj)}</span>
                                  <span className={`token-status ${tokenObj.status}`}>
                                    {tokenObj.status === 'success' ? (
                                      <span style={{color:'#212121', backgroundColor:'rgba(0, 255, 157, 0.7)', padding:'2px 6px', borderRadius:'3px', fontWeight:500}}>
                                        Trader Active ✓
                                      </span>
                                    ) : tokenObj.status === 'error' ? (
                                      <span style={{color:'#212121', backgroundColor:'rgba(255, 58, 58, 0.7)', padding:'2px 6px', borderRadius:'3px', fontWeight:500}}>
                                        Configuration Error ⚠️
                                      </span>
                                    ) : (
                                      <span style={{color:'#212121', backgroundColor:'rgba(255, 204, 0, 0.7)', padding:'2px 6px', borderRadius:'3px', fontWeight:500}}>
                                        Awaiting Activation
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <span 
                                  className='remove-token' 
                                  title="Stop Copy Trading"
                                  onClick={() => handleRemoveToken(index)}
                                >
                                  ×
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className='button-container' style={{ display: 'none' }} >
                        <button 
                          id="start-copy-trading" 
                          className='cyber-button activate'
                          onClick={handleStartCopyTrading}
                        >
                          <span className='button-text'>START COPY TRADING</span>
                          <span className='button-glitch'></span>
                        </button>
                      
                        <button 
                          id="stop-copy-trading" 
                          className='cyber-button deactivate'
                          onClick={handleStopCopyTrading}
                        >
                          <span className='button-text'>STOP COPY TRADING</span>
                          <span className='button-glitch'></span>
                        </button>
                      
                        <button 
                          id="allow-copy" 
                          className='cyber-button'
                          onClick={handleAllowCopy}
                        >
                          <span className='button-text'>ALLOW COPY</span>
                          <span className='button-glitch'></span>
                        </button>
                      
                        <button 
                          id="disallow-copy" 
                          className='cyber-button secondary'
                          onClick={handleDisallowCopy}
                        >
                          <span className='button-text'>DIS-ALLOW COPY</span>
                          <span className='button-glitch'></span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div id="copy-trading-list" className='hub-card results-card'>
                    <div className='card-shine'></div>
                    <div className='hub-card-header'>
                      <div className='card-title'>TRADE ANALYTICS</div>
                      <div className='card-status'>LIVE</div>
                    </div>
                    <div className='hub-card-content'>
                      <div className='data-tabs'>
                        <div 
                          className={`data-tab ${activeTab === 'trader-list' ? 'active' : ''}`} 
                          data-target="trader-list"
                          onClick={() => setActiveTab('trader-list')}
                        >
                          Trader Data
                        </div>
                        <div 
                          className={`data-tab ${activeTab === 'trading-stats' ? 'active' : ''}`} 
                          data-target="trading-stats"
                          onClick={() => setActiveTab('trading-stats')}
                        >
                          Statistics
                        </div>
                      </div>

                      <div className='data-content-wrapper'>
                        <div 
                          id="copy-trading-list-container" 
                          className={`data-container ${activeTab === 'trader-list' ? 'active' : ''}`}
                        >
                          {tradersData.length === 0 ? (
                            <div className='placeholder-text'>Awaiting trader data...</div>
                          ) : (
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                              {tradersData.map((trader, index) => (
                                <li key={index} style={{ marginBottom: '10px' }}>
                                  <strong>Linked Copy Trader:</strong> {trader.loginid === 'VRTC8609996' ? 'ELITESCOPE TRADERS' : trader.loginid} <br />
                                  <strong>Assets:</strong> {trader.assets?.map((asset: string) => asset === '*' ? 'ALL ASSETS' : asset).join(', ') || 'N/A'} <br />
                                  <strong>Max Trade Stake:</strong> {trader.max_trade_stake || 'N/A'} <br />
                                  <strong>Min Trade Stake:</strong> {trader.min_trade_stake || 'N/A'} <br />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div 
                          id="copy-trading-stats-container" 
                          className={`data-container stats-container ${activeTab === 'trading-stats' ? 'active' : ''}`}
                        >
                          {Object.keys(statsData).length === 0 ? (
                            <div className='placeholder-text'>Calculating statistics...</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Statistic</th>
                                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {statsData.active_since && (
                                  <tr>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Active Since</strong></td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                      {new Date(statsData.active_since * 1000).toLocaleDateString()}
                                    </td>
                                  </tr>
                                )}
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Average Duration</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.avg_duration || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Average Loss</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.avg_loss || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Average Profit</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.avg_profit || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Number of Copiers</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.copiers || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Total Trades</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.total_trades || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Trades Profitable</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.trades_profitable || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Performance Probability</strong></td>
                                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{statsData.performance_probability || 'N/A'}</td>
                                </tr>
                                {statsData.monthly_profitable_trades && Object.entries(statsData.monthly_profitable_trades).map(([month, profit]) => (
                                  <tr key={`month-${month}`}>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Monthly Profit - {month}</strong></td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{String(profit)}</td>
                                  </tr>
                                ))}
                                {statsData.yearly_profitable_trades && Object.entries(statsData.yearly_profitable_trades).map(([year, profit]) => (
                                  <tr key={`year-${year}`}>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Yearly Profit - {year}</strong></td>
                                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{String(profit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
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
                    <span className='status-label'>LAST UPDATE:</span>
                    <span className='status-value'>JUST NOW</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CopyTrading1;