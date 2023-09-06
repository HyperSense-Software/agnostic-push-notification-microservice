let {SecretsManagerClient, GetSecretValueCommand} = require("@aws-sdk/client-secrets-manager");
const secretName = process.env.SECRET_NAME;
const client = new SecretsManagerClient({
    region: process.env.AWS_REGION
});

/**
 * Example for loading a secret value (String)
 * const secrets = await client.getSecretValue({ SecretId: secretName }).promise();
 * let jsonSecrets = JSON.parse(secrets.SecretString);
 */

let SecretsManager = {};
let allSecrets = null;

SecretsManager.getSecrets = async function (key)
{
    if (!allSecrets)
    {
        let getSecretValueCommand = new GetSecretValueCommand({SecretId: secretName});
        let secrets = await client.send(getSecretValueCommand);
        allSecrets = JSON.parse(secrets.SecretString);    
    }

    return allSecrets[key];
}

module.exports = SecretsManager;