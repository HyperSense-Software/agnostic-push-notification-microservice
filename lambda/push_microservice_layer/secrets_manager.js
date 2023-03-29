const AWS = require('aws-sdk');
const secretName = "PushMicroserviceCredentials";
const client = new AWS.SecretsManager({
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
        let secrets = await client.getSecretValue({ SecretId: secretName }).promise();
        allSecrets = JSON.parse(secrets.SecretString);    
    }

    return allSecrets[key];
}

module.exports = SecretsManager;