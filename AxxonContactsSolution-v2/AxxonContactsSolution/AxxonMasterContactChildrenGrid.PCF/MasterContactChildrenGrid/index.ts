import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ChildContactsGrid, IChildContact } from "./ChildContactsGrid";
import * as React from "react";

const CONTACT_ENTITY = "contact";

/**
 * Builds the FetchXML query for child contacts of a given master contact.
 * Joins:
 *   contact.msdyn_company       → cdm_company.cdm_companyid      (alias: Company)
 *   contact.msdyn_customergroupid → msdyn_customergroup.msdyn_customergroupid (alias: CustomerGroup)
 *   contact.msdyn_paymentterms  → msdyn_paymentterm.msdyn_paymenttermid      (alias: PaymentTerms)
 */
function buildFetchXml(masterContactId: string): string {
    return `<fetch top="50">
  <entity name="contact">
    <attribute name="contactid" />
    <attribute name="fullname" />
    <filter>
      <condition attribute="axx_mastercontactid" operator="eq" value="${masterContactId}" />
    </filter>
    <link-entity name="cdm_company" from="cdm_companyid" to="msdyn_company" link-type="inner" alias="Company">
      <attribute name="cdm_name" />
      <attribute name="cdm_companycode" />
    </link-entity>
    <link-entity name="msdyn_customergroup" from="msdyn_customergroupid" to="msdyn_customergroupid" link-type="outer" alias="CustomerGroup">
      <attribute name="msdyn_description" />
    </link-entity>
    <link-entity name="msdyn_paymentterm" from="msdyn_paymenttermid" to="msdyn_paymentterms" link-type="outer" alias="PaymentTerms">
      <attribute name="msdyn_description" />
    </link-entity>
  </entity>
</fetch>`;
}

// FetchXML aliased columns are returned as "Alias.fieldname" keys
interface IContactEntity {
    contactid: string;
    fullname: string;
    "Company.cdm_name"?: string;
    "Company.cdm_companycode"?: string;
    "CustomerGroup.msdyn_description"?: string;
    "PaymentTerms.msdyn_description"?: string;
}

export class MasterContactChildrenGrid implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private context: ComponentFramework.Context<IInputs>;

    private contacts: IChildContact[] = [];
    private isLoading = false;
    private errorMessage: string | null = null;
    private lastMasterContactId: string | null = null;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        this.context = context;

        const masterContactId = ((context as unknown as { page?: { entityId?: string } }).page?.entityId) ?? null;

        if (masterContactId && masterContactId !== this.lastMasterContactId) {
            this.lastMasterContactId = masterContactId;
            void this.loadChildContacts(masterContactId);
        } else if (!masterContactId && this.contacts.length > 0) {
            this.contacts = [];
            this.lastMasterContactId = null;
        }

        return React.createElement(ChildContactsGrid, {
            contacts: this.contacts,
            isLoading: this.isLoading,
            errorMessage: this.errorMessage,
        });
    }

    private async loadChildContacts(masterContactId: string): Promise<void> {
        this.isLoading = true;
        this.errorMessage = null;
        this.notifyOutputChanged();

        const fetchXml = buildFetchXml(masterContactId);
        const options = `?fetchXml=${encodeURIComponent(fetchXml)}`;

        try {
            const result = await this.context.webAPI.retrieveMultipleRecords(CONTACT_ENTITY, options);
            this.contacts = (result.entities as unknown as IContactEntity[]).map((e) => ({
                contactid: e.contactid,
                fullname: e.fullname ?? "",
                legalEntityName: e["Company.cdm_name"] ?? "",
                companyCode: e["Company.cdm_companycode"] ?? "",
                customerGroupName: e["CustomerGroup.msdyn_description"] ?? "",
                paymentTerms: e["PaymentTerms.msdyn_description"] ?? "",
            }));
            this.isLoading = false;
            this.notifyOutputChanged();
        } catch (error) {
            this.errorMessage = `Error loading contacts: ${(error as Error).message}`;
            this.isLoading = false;
            this.notifyOutputChanged();
        }
    }

    public getOutputs(): IOutputs {
        return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public destroy(): void {}
}
