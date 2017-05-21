module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
	"parserOptions": {
        "ecmaVersion": 2017,
        "sourceType": "module",
        "ecmaFeatures": {
	        "jsx": true
        }
    },
    "extends": "eslint:recommended",
    "rules": {
		"no-console": "off",
        "indent": [
            "error",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};
