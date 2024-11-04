usage() { echo "Usage:
  $0 [-e <development|production>] [-p <string>]
  -e deployment environment, defaults to DEPLOYMENT_ENV
  -p profile to be used by the CDK, defaults to PROFILE
" 1>&2; exit 1; }

env=${DEPLOYMENT_ENV}
profile=${PROFILE}
while getopts ":e:p:" o; do
    case "${o}" in
        e)
            env=${OPTARG}
            ;;
        p)
            profile=${OPTARG}
            ;;
        *)
            usage
            ;;
    esac
done
shift $((OPTIND-1))

if [ -z "${env}" ]; then
  usage
fi

echo "INSTALLING NPMs"

  # add all npm installs here
  echo "npm install"
  npm install
  echo "npm --prefix ./opt/push_microservice_layer install"
  npm --prefix ./opt/push_microservice_layer install


  if [ -z "${profile}" ]; then
    echo "CDK DEPLOYMENT: DEPLOYMENT_ENV=${env} cdk deploy"
    DEPLOYMENT_ENV=${env} cdk deploy
    else
    echo "CDK DEPLOYMENT: DEPLOYMENT_ENV=${env} cdk deploy --profile=${profile}"
    DEPLOYMENT_ENV=${env} cdk deploy --profile="${profile}"
  fi
