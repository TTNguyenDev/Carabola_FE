import React, { useState, useEffect } from 'react';
import { Form, Input, Grid } from 'semantic-ui-react';
import { TxButton } from './substrate-lib/components';

import { ApiPromise, Keyring } from '@polkadot/api';
import * as web3Utils from 'web3-utils';
import * as crypto from '@polkadot/util-crypto';
import { string } from 'prop-types';

import { Json } from '@polkadot/types';
export default function Main (props) {
  const [status, setStatus] = useState('');
  const [proposal, setProposal] = useState({});
  const { accountPair } = props;
  const [aliceEvmAccount, setAliceEvmAccount] = useState('');
  // Keyring needed to sign using Alice account
  const keyring = new Keyring({ type: 'sr25519' });

  // ByteCode of our ERC20 exemple: copied from ./truffle/contracts/MyToken.json
  const ERC20_BYTECODES = require('./MyToken.json').object;

  const [formState, setFormState] = useState({ evm_account: '', bytecode :'',value:0, gas_limit: 0, gas_price: 0, nounce:null });

  const onChange = (_, data) =>
  setFormState(prev => ({ ...prev, [data.state]: data.value }));

  const { evm_account, bytecode, value ,gas_limit, gas_price, nounce} = formState;

  useEffect(() => {
    async function initData () {
      const { api, alice, bob , aliceEvmAccount, BobEvmAccount} = await init();

      setAliceEvmAccount(aliceEvmAccount);

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
    const bobEvmAccount = `0x${crypto.blake2AsHex(crypto.decodeAddress(bob.address), 256).substring(26)}`;

    console.log(`Alice EVM Account: ${aliceEvmAccount}`);
    // const evmData = (await api.query.evm.accountsCodes(aliceEvmAccount));
    // console.log(`Alice EVM Account (nonce: ${evmData.nonce}) balance: ${evmData.balance.toHex()}`);

    return { api, alice, bob, aliceEvmAccount, bobEvmAccount };
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
            <Form>
                <Form.Field style={{ textAlign: 'center' }}>
                    <Input
                      fluid
                      label='EVM Account'
                      type='string'
                      state='evm_account'
                      onChange={onChange}
                    />
                    <Input
                      fluid
                      label='bytecode'
                      type='string'
                      state='bytecode'
                      onChange={onChange}
                    />
                    <Input
                      fluid
                      label='value'
                      type='number'
                      state='value'
                      onChange={onChange}
                    />
                    <Input
                      fluid
                      label='gas limit'
                      type='number'
                      state='gas_limit'
                      onChange={onChange}
                    />
                    <Input
                      fluid
                      label='gas price'
                      type='number'
                      state='gas_price'
                      onChange={onChange}
                    />
                    <TxButton
                        accountPair={accountPair}
                        label='Call Smart Contract ERC20'
                        type='SIGNED-TX'
                        setStatus={setStatus}
                        attrs={{
                          palletRpc: 'evm',
                          callable: 'create',
                          inputParams: [aliceEvmAccount, ERC20_BYTECODES, 0, 8294967295,1 , null],
                          paramFields: [true, true, true, true, true, true, true],
                      
                        }}
                        disabled
                    />
                </Form.Field>
                <div style={{ overflowWrap: 'break-word' }}>{status}</div>
            </Form>
        </Grid.Column>
  );
}
