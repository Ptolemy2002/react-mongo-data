#! /usr/bin/bash
if [ $# -ge 1 ]; then
    bump_type=$1

    if [[ $bump_type -ne "major" && $bump_type -ne "minor" && $bump_type -ne "patch" ]]; then
        echo "Invalid bump type: $bump_type"
        exit 1
    fi

    echo "Bumping the version with $bump_type"
    eval "npm version $bump_type"
else
    echo "No bump type provided. Will release with the current version"
fi

bash scripts/build.sh

echo "Publishing the package"
npm publish --access public
echo "Finished publishing the package"