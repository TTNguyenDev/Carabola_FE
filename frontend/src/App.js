import React, { useState, createRef, useEffect } from 'react';
import { Container, Dimmer, Loader, Grid, Sticky, Message } from 'semantic-ui-react';
import 'semantic-ui-css/semantic.min.css';

import { ApiPromise, Keyring } from '@polkadot/api';
import * as web3Utils from 'web3-utils';
import * as crypto from '@polkadot/util-crypto';

import { SubstrateContextProvider, useSubstrate } from './substrate-lib';
import { DeveloperConsole } from './substrate-lib/components';

import AccountSelector from './AccountSelector';
import BlockNumber from './BlockNumber';
import Events from './Events';
import Interactor from './Interactor';
import Metadata from './Metadata';
import NodeInfo from './NodeInfo';
import Transfer from './Transfer';
import Upgrade from './Upgrade';

function Main () {
  const [accountAddress, setAccountAddress] = useState(null);
  const { api, apiState, keyringState, apiError } = useSubstrate();
  // Keyring needed to sign using Alice account
  const keyring = new Keyring({ type: 'sr25519' });

  // ByteCode of our ERC20 exemple: copied from ./truffle/contracts/MyToken.json
  const ERC20_BYTECODES = require('./MyToken.json').bytecode;

  const accountPair =
        accountAddress &&
        keyringState === 'READY' &&
        keyring.getPair(accountAddress);

  useEffect(() => {
    async function initData () {
      const { api, alice, bob } = await init();

      // step 1: Creating the contract from ALICE
      const contractAccount = await step1(api, alice);

      // step 2: Retrieving Alice and Contract information
      await step2(api, alice, contractAccount.address);

      // step 3: Transfering Smart Contract tokens from Alice to Bob
      await step3(api, alice, bob, contractAccount.address);

      // step 3: Retrieving Bob information
      await step4(api, bob, contractAccount.address);
    }
    initData();
  }, []);

  // Setup the API and Alice Account
  async function init () {
    console.log('Initiating the API (ignore message "Unable to resolve type B..." and "Unknown types found...")');

    // Initiate the polkadot API.
    // console.log('Initialiation done');
    // console.log(`Genesis at block: ${api.genesisHash.toHex()}`);

    const alice = keyring.addFromUri('//Alice', { name: 'Alice default' });
    const bob = keyring.addFromUri('//Bob', { name: 'Bob default' });

    const { nonce, data: balance } = await api.query.system.account(alice.address);
    console.log(`Alice Substrate Account: ${alice.address}`);
    console.log(`Alice Substrate Account (nonce: ${nonce}) balance, free: ${balance.free.toHex()}`);

    const aliceEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(alice.address), 256).substring(26)}`;

    console.log(`Alice EVM Account: ${aliceEvmAccount}`);
    const evmData = (await api.query.evm.accounts(aliceEvmAccount));
    console.log(`Alice EVM Account (nonce: ${evmData.nonce}) balance: ${evmData.balance.toHex()}`);

    return { api, alice, bob };
  }

  // Create the ERC20 contract from ALICE
  async function step1 (api, alice) {
    console.log('\nStep 1: Creating Smart Contract');

    // params: [bytecode, initialBalance, gasLimit, gasPrice],
    // tx: api.tx.evm.create

    const transaction = await api.tx.evm.create(ERC20_BYTECODES, 0, 4294967295, 1, null);

    const contract = new Promise() < { block, address } > (async (resolve, reject) => {
      const unsub = await transaction.signAndSend(alice, (result) => {
        console.log(`Contract creation is ${result.status}`);
        if (result.status.isInBlock) {
          console.log(`Contract included at blockHash ${result.status.asInBlock}`);
          console.log('Waiting for finalization... (can take a minute)');
        } else if (result.status.isFinalized) {
          const contractAddress = (
            result.events?.find(
              event => event?.event?.index.toHex() === '0x0500'
            )?.event.data[0]
          ).address;
          console.log(`Contract finalized at blockHash ${result.status.asFinalized}`);
          console.log(`Contract address: ${contractAddress}`);
          unsub();
          resolve({
            block: result.status.asFinalized.toString(),
            address: contractAddress
          });
        }
      });
    });
    return contract;
  }

  // Retrieve Alice & Contract Storage
  async function step2 (api, alice, contractAddress) {
    console.log(`\nStep 2: Retrieving Contract from evm address: ${contractAddress}`);

    // Retrieve Alice account with new nonce value
    const { nonce, data: balance } = await api.query.system.account(alice.address);
    console.log(`Alice Substrate Account (nonce: ${nonce}) balance, free: ${balance.free}`);

    const accountCode = (await api.query.evm.accountCodes(contractAddress)).toString();
    console.log(`Contract account code: ${accountCode.substring(0, 16)}...${accountCode.substring(accountCode.length - 16)}`);

    // Computing Contract Storage Slot, using slot 0 and alice EVM account
    const aliceEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(alice.address), 256).substring(26)}`;
    const slot = '0';
    const mapStorageSlot = slot.padStart(64, '0');
    const mapKey = aliceEvmAccount.toString().substring(2).padStart(64, '0');

    const storageKey = web3Utils.sha3('0x'.concat(mapKey.concat(mapStorageSlot)));
    console.log(`Alice Contract storage key: ${storageKey}`);

    const accountStorage = (await api.query.evm.accountStorages(contractAddress, storageKey)).toString();
    console.log(`Alice Contract account storage: ${accountStorage}`);
  }

  // Transfer tokens to Bob
  async function step3 (api, alice, bob, contractAddress) {
    const bobEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(bob.address), 256).substring(26)}`;
    console.log(`\nStep 3: Transfering Tokens to Bob EVM Account: ${bobEvmAccount}`);

    console.log('Preparing transfer of 0xdd');
    // params: [contractAddress, inputCode, value,m gasLimit, gasPrice],
    // tx: api.tx.evm.create
    const transferFnCode = 'a9059cbb000000000000000000000000';
    const tokensToTransfer = '00000000000000000000000000000000000000000000000000000000000000dd';
    const inputCode = `0x${transferFnCode}${bobEvmAccount.substring(2)}${tokensToTransfer}`;
    console.log(`Sending call input: ${inputCode}`);
    const transaction = await api.tx.evm.call(contractAddress, inputCode, 0, 4294967295, 1, null);

    const data = new Promise() < { block, address } > (async (resolve, reject) => {
      const unsub = await transaction.signAndSend(alice, (result) => {
        console.log(`Transfer is ${result.status}`);
        if (result.status.isInBlock) {
          console.log(`Transfer included at blockHash ${result.status.asInBlock}`);
          console.log('Waiting for finalization... (can take a minute)');
        } else if (result.status.isFinalized) {
          console.log(`Transfer finalized at blockHash ${result.status.asFinalized}`);
          unsub();
          resolve();
        }
      });
    });
    return data;
  }

  // Retrieve Bob
  async function step4 (api, bob, contractAddress) {
    console.log('\nStep 4: Retrieving Bob tokens');

    // Retrieve Bob account with new nonce value
    const { nonce, data: balance } = await api.query.system.account(bob.address);
    console.log(`Bob Substrate Account (nonce: ${nonce}) balance, free: ${balance.free}`);
    const bobEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(bob.address), 256).substring(26)}`;

    console.log(`Bob EVM Account: ${bobEvmAccount}`);
    const evmData = (await api.query.evm.accounts(bobEvmAccount));
    console.log(`Bob EVM Account (nonce: ${evmData.nonce}) balance: ${evmData.balance.toHex()}`);

    const slot = '0';
    const mapStorageSlot = slot.padStart(64, '0');
    const mapKey = bobEvmAccount.toString().substring(2).padStart(64, '0');

    const storageKey = web3Utils.sha3('0x'.concat(mapKey.concat(mapStorageSlot)));
    console.log(`Bob Contract storage key: ${storageKey}`);

    const accountStorage = (await api.query.evm.accountStorages(contractAddress, storageKey)).toString();
    console.log(`Bob Contract account storage: ${accountStorage}`);
  }

  const loader = text =>
        <Dimmer active>
            <Loader size='small'>{text}</Loader>
        </Dimmer>;

  const message = err =>
        <Grid centered columns={2} padded>
            <Grid.Column>
                <Message negative compact floating
                    header='Error Connecting to Substrate'
                    content={`${JSON.stringify(err, null, 4)}`}
                />
            </Grid.Column>
        </Grid>;

  if (apiState === 'ERROR') return message(apiError);
  else if (apiState !== 'READY') return loader('Connecting to Substrate');

  if (keyringState !== 'READY') {
    return loader('Loading accounts (please review any extension\'s authorization)');
  }

  const contextRef = createRef();

  return (
        <div ref={contextRef}>
            <Sticky context={contextRef}>
                <AccountSelector setAccountAddress={setAccountAddress} />
            </Sticky>
            <Container>
                <Grid stackable columns='equal'>
                    <Grid.Row stretched>
                        <NodeInfo />
                        <Metadata />
                        <BlockNumber />
                        <BlockNumber finalized />
                    </Grid.Row>
                    <Grid.Row>
                        <Transfer accountPair={accountPair} />
                        <Upgrade accountPair={accountPair} />
                    </Grid.Row>
                    <Grid.Row>
                        <Interactor accountPair={accountPair} />
                        <Events />
                    </Grid.Row>
                </Grid>
            </Container>
            <DeveloperConsole />
        </div>
  );
}

export default function App () {
  return (
        <SubstrateContextProvider>
            <Main />
        </SubstrateContextProvider>
  );
}
