import connectIco from './connect.svg';
import './App.css';
import { Modal, Input, Tooltip, Button, message } from 'antd';
import { UserOutlined, QuestionOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import browser from 'browser-detect';
import { useEffect, useState } from 'react';

const browserInfo = browser();
function App() {
  const [token, changeToken] = useState('');
  const [showToken, toggleToken] = useState(false);
  const [showModal, toggleModal] = useState(true);
  const [username, changeUsername] = useState('');
  const [submitted, changeSubmitStatus] = useState(false);
  console.log(showModal)
  useEffect(function () {
    setTimeout(() => {
      changeToken('eiAF1312huaifhASDFewh6u');
    }, 200);
  }, []);
  function getNewToken() {
    fetch('/getmytoken', {
      method: 'POST', body: JSON.stringify({ user: username }), headers: {
        'content-type': 'application/json'
      },
    }).then(response => {
      return response.json();
    }).then(content => {
      changeToken(content.data.token);
      changeSubmitStatus(true);
    })
  }
  function onSubmitUsername() {
    console.log(username)
    if (username) {
      toggleModal(false);
      getNewToken();
    } else {
      message.info('用户名不能为空');
    }
  }
  return (
    <div className="App">
      <Modal
        title="只需一步"
        style={{ top: 20 }}
        visible={showModal}
        footer={[
          <Button key="submit" type="primary" onClick={onSubmitUsername}>
            确认
          </Button>,
        ]}
      >
        <p>请输入你想使用的用户名，这将作为你的<Tooltip title="这是区分你与其它用户的标识" arrowPointAtCenter><strong>连接标识</strong></Tooltip></p>
        <Input placeholder="用户名" prefix={<UserOutlined />} onChange={e => changeUsername(e.target.value)} value={username} />
      </Modal>
      <header className="App-header">
        <img src={connectIco} className="App-logo" alt="logo" />
        {
          submitted ? <p className="token-title">
            你的 Token
          <Tooltip title="token是创建与服务器连接的凭据" arrowPointAtCenter>
              <QuestionOutlined style={{ fontSize: '10px', color: '#08c', verticalAlign: 'top' }} />
            </Tooltip>
          已创建：{showToken ? token : '**********'}
            {
              showToken ?
                <EyeOutlined
                  style={{ fontSize: '12px', color: '#08c', verticalAlign: 'top', paddingLeft: 5, cursor: 'pointer' }}
                  onClick={() => toggleToken(!showToken)} />
                : <EyeInvisibleOutlined
                  style={{ fontSize: '12px', color: '#08c', verticalAlign: 'top', paddingLeft: 5, cursor: 'pointer' }}
                  onClick={() => toggleToken(!showToken)} />
            }
          </p> : <p className="token-title">
              Token 未创建，请先设置用户名
            </p>
        }

        <p className="os-name">操作系统：{browserInfo.os}<a className="other-versions" href="https://github.com/hjylxmhzq/BrNat-client/releases" target="_blank">其它版本</a></p>
        <a
          className="App-link"
          href={browserInfo.os.toLowerCase().includes('os') ?
            "/assets/Easy-Online Client.dmg" :
            "/assets/Easy-Online Client Setup.exe"}
          target="_blank"
          rel="noopener noreferrer"
        >
          {browserInfo.mobile ? '不支持移动端操作系统' : '开始使用'}
        </a>
      </header>
    </div>
  );
}

export default App;
