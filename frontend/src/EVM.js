import React, { useState, useEffect } from 'react';
import { Form, Input, Grid } from 'semantic-ui-react';
import { TxButton } from './substrate-lib/components';

import { ApiPromise, Keyring } from '@polkadot/api';
import * as web3Utils from 'web3-utils';
import * as crypto from '@polkadot/util-crypto';
import { string } from 'prop-types';

export default function Main (props) {
  const [status, setStatus] = useState('');
  const [proposal, setProposal] = useState({});
  const { accountPair } = props;

  // Keyring needed to sign using Alice account
  const keyring = new Keyring({ type: 'sr25519' });

  // ByteCode of our ERC20 exemple: copied from ./truffle/contracts/MyToken.json
  const ERC20_BYTECODES = require('./MyToken.json').bytecode;

  useEffect(() => {
    async function initData () {
      const { api, alice, bob } = await init();

      // step 1: Creating the contract from ALICE
      const contractAccount = await step1(api, alice);
      console.log(await contractAccount());

      // step 2: Retrieving Alice and Contract information
      await step2(api, alice, contractAccount);

      // step 3: Transfering Smart Contract tokens from Alice to Bob
      // await step3(api, alice, bob, contractAccount.address);

      // step 3: Retrieving Bob information
      // await step4(api, bob, contractAccount.address);
    }
    initData();
  }, []);

  async function init () {
    console.log('Initiating the API (ignore message "Unable to resolve type B..." and "Unknown types found...")');

    // Initiate the polkadot API.
    console.log('Initialiation done');
    console.log(`Genesis at block: ${api.genesisHash.toHex()}`);

    const alice = keyring.addFromUri('//Alice', { name: 'Alice default' });
    const bob = keyring.addFromUri('//Bob', { name: 'Bob default' });

    const { nonce, data: balance } = await api.query.system.account(alice.address);
    console.log(`Alice Substrate Account: ${alice.address}`);
    console.log(`Alice Substrate Account (nonce: ${nonce}) balance, free: ${balance.free.toHex()}`);

    const aliceEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(alice.address), 256).substring(26)}`;

    console.log(`Alice EVM Account: ${aliceEvmAccount}`);
    // const evmData = (await api.query.evm.accountsCodes(aliceEvmAccount));
    // console.log(`Alice EVM Account (nonce: ${evmData.nonce}) balance: ${evmData.balance.toHex()}`);

    return { api, alice, bob };
  }

  // Create the ERC20 contract from ALICE
  async function step1 (api, alice) {
    console.log('\nStep 1: Creating Smart Contract');

    // params: [bytecode, initialBalance, gasLimit, gasPrice],
    // tx: api.tx.evm.create

    const transaction = await api.tx.evm.create(alice, ERC20_BYTECODES, 0, 4294967295, 1, null);

    const contract = (block, address) => new Promise(async (resolve, reject) => {
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
          console.log('hello');
          console.log(contractAddress);
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

  return (
        <Grid.Column width={8}>
            <h1>EVM</h1>
            <h2>Alice Balance: 0</h2>
            <h2>Bob Balance: 0</h2>
            <Form>
                <Form.Field style={{ textAlign: 'center' }}>
                    <TxButton
                        accountPair={accountPair}
                        label='Transfer from Alice to Bob'
                        type='UNCHECKED-SUDO-TX'
                        setStatus={setStatus}
                        attrs={{
                          palletRpc: 'evm',
                          callable: 'call',
                          inputParams: [],
                          paramFields: [true]
                        }}
                    />
                </Form.Field>
                <div style={{ overflowWrap: 'break-word' }}>{status}</div>
            </Form>
        </Grid.Column>
  );
}
