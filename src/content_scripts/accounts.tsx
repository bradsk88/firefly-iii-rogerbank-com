import {
    AccountRoleProperty,
    AccountStore,
    CreditCardType,
    ShortAccountTypeProperty
} from "firefly-iii-typescript-sdk-fetch";

function scrapeAccountsFromPage(): AccountStore[] {
    // TODO: This is where you implement the scraper to pull the individual
    //  accounts from the page

    const [name] = document.querySelectorAll("div.banner-title > div.jsx-parser").values();

    return [
        {
            name: name.textContent!,
            type: ShortAccountTypeProperty.Asset,
            accountRole: AccountRoleProperty.CcAsset,
            accountNumber: name.textContent!.split('...')[1],
            creditCardType: CreditCardType.MonthlyFull,
            monthlyPaymentDate: new Date(2023, 1, 1),
        }
    ];
}

window.addEventListener("load",function(event) {
    // TODO: Prompt for currency. Do all Rogers accounts use CAD?

    const button = document.createElement("button");
    button.textContent = "Export Account"
    button.addEventListener("click", () => {
        const accounts = scrapeAccountsFromPage();

        console.log('sending accounts for storage', accounts);

        chrome.runtime.sendMessage(
            {
                action: "store_accounts",
                value: accounts,
            },
            () => {}
        );
    }, false);

    button.classList.add('btn-default', 'ui-dropdown-btn', 'dropdown-toggle', 'btn', 'btn-default');

    const container = document.createElement("div");
    container.classList.add('quick-link-options')
    container.append(button)
    container.style.border = 'none';
    container.style.textAlign = 'end';

    setTimeout(() => {
        const [housing] = document.querySelectorAll("div.banner-title");
        housing.append(container);
    }, 2000); // TODO: A smarter way of handling render delay
});
