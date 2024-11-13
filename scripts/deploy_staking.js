const web3 = require("@solana/web3.js");
const borsh = require("borsh");
const fs = require("fs");

// for reference:
// const connection = new web3.Connection(clusterApiUrl("mainnet-beta"), "confirmed");
// new web3.Connection("http://127.0.0.1:8899", "confirmed");

// Helper function to establish connection
async function establishConnection(clusterName = "devnet") {
  let rpcUrl = "http://127.0.0.1:8899";
  
  if (clusterName != "localnet") {    
    rpcUrl = web3.clusterApiUrl(clusterName);
  }

  const connection = new web3.Connection(rpcUrl, "confirmed");

  return connection;
}

// Helper function to get or create keypair
function getOrCreateKeypair(keyPath = "deployer-keypair.json") {
  let keypair;
  try {
    const secretKey = JSON.parse(fs.readFileSync(keyPath));
    keypair = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch {
    keypair = web3.Keypair.generate();
    fs.writeFileSync(keyPath, JSON.stringify(Array.from(keypair.secretKey)));
  }
  return keypair;
}

// Helper function to get account balance
async function getBalance(connection, publicKey) {
  const balance = await connection.getBalance(publicKey);
  return balance / web3.LAMPORTS_PER_SOL;
}

// Helper function to request airdrop
async function requestAirdrop(connection, address, amount) {
  const signature = await connection.requestAirdrop(
    address,
    amount * web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature);
}

// Deploy program
async function deployProgram(connection, payerKeypair, programPath) {
  // Read the program binary
  const programData = fs.readFileSync(programPath);

  // Create program keypair
  const programKeypair = web3.Keypair.generate();

  // Calculate deployment cost
  const PROGRAM_SIZE = programData.length;
  const rent = await connection.getMinimumBalanceForRentExemption(PROGRAM_SIZE);

  // Create deployment transaction
  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payerKeypair.publicKey,
      newAccountPubkey: programKeypair.publicKey,
      lamports: rent,
      space: PROGRAM_SIZE,
      programId: new web3.PublicKey(
        "BPFLoaderUpgradeab1e11111111111111111111111"
      ),
    }),
    web3.SystemProgram.transfer({
      fromPubkey: payerKeypair.publicKey,
      toPubkey: programKeypair.publicKey,
      lamports: rent,
    }),
    web3.BpfLoaderUpgradeable.load({
      programId: programKeypair.publicKey,
      programData: programData,
    })
  );

  // Send and confirm transaction
  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [payerKeypair, programKeypair]
  );

  return programKeypair.publicKey;
}

// Initialize staking program
async function initializeStakingProgram(
  connection,
  payer,
  programId,
  mintAddress,
  stakingPeriod,
  rewardRate
) {
  // Generate keypair for state account
  const stateAccount = web3.Keypair.generate();

  // Define the space needed for state account
  const ACCOUNT_SIZE = 1000; // Adjust based on your program's needs

  // Calculate rent exemption
  const rent = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

  // Create initialization instruction data
  const initData = {
    instruction: 0, // Initialize instruction
    staking_period: stakingPeriod,
    reward_rate: rewardRate,
  };

  // Serialize instruction data using Borsh
  const schema = new Map([
    ["instruction", "u8"],
    ["staking_period", "u64"],
    ["reward_rate", "u64"],
  ]);
  const buffer = borsh.serialize(schema, initData);

  // Create transaction
  const transaction = new web3.Transaction().add(
    // Create state account
    web3.SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: stateAccount.publicKey,
      lamports: rent,
      space: ACCOUNT_SIZE,
      programId: programId,
    }),
    // Initialize program
    new web3.TransactionInstruction({
      keys: [
        { pubkey: stateAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        {
          pubkey: web3.SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: programId,
      data: Buffer.from(buffer),
    })
  );

  // Send and confirm transaction
  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, stateAccount]
  );

  return {
    stateAccount: stateAccount.publicKey,
    signature,
  };
}

// Main deployment function
async function main() {
  try {
    // Connect to devnet
    console.log("Connecting to Solana...");
    const connection = await establishConnection("localnet");
    // const connection = await establishConnection("devnet");
    // const connection = await establishConnection("mainnet-beta");
    console.log("connection:", connection);

    // // Get or create deployer keypair
    // const deployerKeypair = getOrCreateKeypair();
    // console.log("Deployer public key:", deployerKeypair.publicKey.toString());

    // // Check balance
    // let balance = await getBalance(connection, deployerKeypair.publicKey);
    // console.log("Current balance:", balance, "SOL");

    // // Request airdrop if balance is low
    // if (balance < 2) {
    //     console.log('Requesting airdrop...');
    //     await requestAirdrop(connection, deployerKeypair.publicKey, 2);
    //     balance = await getBalance(connection, deployerKeypair.publicKey);
    //     console.log('New balance:', balance, 'SOL');
    // }

    // // Deploy program
    // console.log('Deploying program...');
    // const programId = await deployProgram(
    //     connection,
    //     deployerKeypair,
    //     'path/to/your/program.so'  // Replace with actual path to your compiled program
    // );
    // console.log('Program deployed at:', programId.toString());

    // // Create mint address (you should replace this with your actual token mint)
    // const mintKeypair = web3.Keypair.generate();
    // const mintAddress = mintKeypair.publicKey;

    // // Initialize program
    // console.log('Initializing program...');
    // const { stateAccount, signature } = await initializeStakingProgram(
    //     connection,
    //     deployerKeypair,
    //     programId,
    //     mintAddress,
    //     BigInt(86400), // 24 hours staking period
    //     BigInt(500)    // 5% reward rate (50/1000)
    // );

    // console.log('Program initialized!');
    // console.log('State account:', stateAccount.toString());
    // console.log('Transaction signature:', signature);
    // console.log('Mint address:', mintAddress.toString());
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

// Helper function to create stake account
async function createStakeAccount(
  connection,
  payer,
  programId,
  stateAccount,
  userPubkey
) {
  const stakeAccount = web3.Keypair.generate();
  const STAKE_ACCOUNT_SIZE = 1000; // Adjust based on your program's needs

  const rent = await connection.getMinimumBalanceForRentExemption(
    STAKE_ACCOUNT_SIZE
  );

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: stakeAccount.publicKey,
      lamports: rent,
      space: STAKE_ACCOUNT_SIZE,
      programId: programId,
    }),
    new web3.TransactionInstruction({
      keys: [
        { pubkey: stakeAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: stateAccount, isSigner: false, isWritable: false },
        { pubkey: userPubkey, isSigner: true, isWritable: false },
        {
          pubkey: web3.SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: programId,
      data: Buffer.from([1]), // Instruction index for creating stake account
    })
  );

  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, stakeAccount]
  );

  return {
    stakeAccount: stakeAccount.publicKey,
    signature,
  };
}

// Run deployment
main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
