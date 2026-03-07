module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

---

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{phone} {
      allow read, write: if request.auth != null
        && request.auth.token.phone_number == ('+91' + phone);
    }
    match /schools/{schoolId}/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}