import React, { useState } from 'react';
import { Form, Input, Grid } from 'semantic-ui-react';
import { TxButton } from './substrate-lib/components';

export default function Main (props) {
  const [status, setStatus] = useState('');
  const [proposal, setProposal] = useState({});
  const { accountPair } = props;

  const bufferToHex = buffer => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleFileChosen = file => {
    const fileReader = new FileReader();
    fileReader.onloadend = e => {
      const content = bufferToHex(fileReader.result);
      setProposal(`0x${content}`);
    };

    fileReader.readAsArrayBuffer(file);
  };

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
              palletRpc: 'system',
              callable: 'setCode',
              inputParams: [proposal],
              paramFields: [true]
            }}
          />
        </Form.Field>
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
      </Form>
    </Grid.Column>
  );
}
