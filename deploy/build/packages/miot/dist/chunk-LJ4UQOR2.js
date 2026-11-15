// src/mi/common.ts
function updateMiAccount(account) {
  return (newAccount) => {
    for (const key in newAccount) {
      account[key] = newAccount[key];
    }
  };
}

export { updateMiAccount };
