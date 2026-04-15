export const trixTomlTemplate = `[protocol]
name = "tx3"
scope = ""
version = "0.0.0"
description = ""
main = "main.tx3"

[profiles.devnet]
chain = "CardanoDevnet"

[[profiles.devnet.wallets]]
name = "alice"
random_key = true
initial_balance = 1000000000000000000

[[profiles.devnet.wallets]]
name = "bob"
random_key = true
initial_balance = 1000000000000000000

[profiles.devnet.trp]
url = "http://localhost:8164"

[profiles.devnet.trp.headers]
api_key=""

[profiles.preview]
chain = "CardanoPreview"

[profiles.preprod]
chain = "CardanoPreprod"

[profiles.mainnet]
chain = "CardanoMainnet"

[[bindings]]
plugin = "typescript"
output_dir = "./bindings"
`;
