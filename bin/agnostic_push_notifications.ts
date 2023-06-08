#!/usr/bin/env node
import { AgnosticPushNotificationsStack } from '../lib/agnostic_push_notifications-stack';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();
new AgnosticPushNotificationsStack(app, 'AgnosticPushNotificationsStack', {
    env: {
        // change this if you have multiple AWS accounts on your system
        // account: <id of your account>,
        region: 'eu-west-1'
    },
    tags :{
        environment: "learning",
        category: "cdk_push_notification",
        project: "AgnosticPushNotifications"
    }
});
