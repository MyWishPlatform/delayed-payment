require('chai')
    .use(require('chai-bignumber')(web3.BigNumber))
    .use(require('chai-as-promised'))
    .should();

const { increaseTime, revert, snapshot } = require('sc-library/test-utils/evmMethods');
const { web3async } = require('sc-library/test-utils/web3Utils');

const DelayedPayment = artifacts.require('./DelayedPayment.sol');
const SimpleERC223Token = artifacts.require('./SimpleERC223Token.sol');

const HOUR = 3600;

contract('Delayed Payment', accounts => {
    const OWNER = accounts[0];
    const BENEFICIARY = accounts[1];

    let now;
    let snapshotId;

    beforeEach(async () => {
        snapshotId = (await snapshot()).result;
        const block = await web3async(web3.eth, web3.eth.getBlock, 'latest');
        now = block.timestamp;
    });

    afterEach(async () => {
        await revert(snapshotId);
    });

    it('#1 construct', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        contract.address.should.have.length(42);
    });

    it('#2 check action cannot be performed before time', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await contract.sendTransaction({ value: web3.toWei(1, 'ether') });

        const tx = await contract.check();
        tx.logs[0].event.should.be.equals('Checked');
        tx.logs.length.should.be.equals(1);
    });

    it('#3 check action cannot be performed with no money', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await increaseTime(HOUR);

        const tx = await contract.check();
        tx.logs[0].event.should.be.equals('Checked');
        tx.logs[1].event.should.be.equals('Triggered');
        tx.logs.length.should.be.equals(2);
    });

    it('#4 check action performed properly after time and with money', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await contract.sendTransaction({ value: web3.toWei(1, 'ether') });
        await increaseTime(HOUR);

        const tx = await contract.check();
        tx.logs[0].event.should.be.equals('Checked');
        tx.logs[1].event.should.be.equals('Triggered');
        tx.logs[2].event.should.be.equals('FundsSent');
        tx.logs.length.should.be.equals(3);
    });

    it('#5 check beneficiary balance after action performed', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await contract.sendTransaction({ value: web3.toWei(10, 'ether') });
        await increaseTime(HOUR);

        const beneficiaryPasswordBeforeCheck = await web3async(web3.eth, web3.eth.getBalance, BENEFICIARY);
        await contract.check();
        const beneficiaryPasswordAfterCheck = await web3async(web3.eth, web3.eth.getBalance, BENEFICIARY);
        beneficiaryPasswordAfterCheck.sub(beneficiaryPasswordBeforeCheck)
            .should.be.bignumber.equal(web3.toWei(1, 'ether'));
    });

    it('#6 check action cannot performed twice', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await contract.sendTransaction({ value: web3.toWei(10, 'ether') });
        await increaseTime(HOUR);

        await contract.check();
        await contract.check().should.eventually.be.rejected;
    });

    it('#7 check action cannot performed not by service account', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await contract.sendTransaction({ value: web3.toWei(10, 'ether') });
        await increaseTime(HOUR);

        await contract.check({ from: BENEFICIARY }).should.eventually.be.rejected;
    });

    it('#8 reject erc223 tokens', async () => {
        const contract = await DelayedPayment.new(OWNER, BENEFICIARY, web3.toWei(1, 'ether'), now + HOUR);
        await increaseTime(HOUR);
        const erc223 = await SimpleERC223Token.new();
        await erc223.transfer(contract.address, 1000).should.eventually.be.rejected;
        await erc223.transfer(BENEFICIARY, 1000);
    });
});
