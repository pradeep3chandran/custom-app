import { LightningElement, api, track } from "lwc";

export default class SchemaPicker extends LightningElement {
	@track consolidatedmodel = [];
	@api journeymodel; // from DataSources event
	@api contactmodel; // from ContactsSchema event

	/**
	 *
	 */
	async connectedCallback() {
		this.consolidatedmodel = [
			this.context,
			this.parseContactModel(this.contactmodel),
			this.parseJourneyModel(this.journeymodel)
		];
	}

	/**
	 *
	 * @param data
	 */
	parseContactModel(data) {
		return {
			label: "Contact Data",
			name: "Contact Data",
			expanded: false,
			items: data.schemaReponse.schema.attributeGroups
				.filter((group) => group.attributeSetIdentifiers)
				.map((group) => {
					const definitions = new Set(group.attributeSetIdentifiers.map(
						(id) => id.definitionID
					));
					return {
						label: group.fullyQualifiedName,
						name: group.definitionID,
						expanded: false,
						items: data.schemaReponse.schema.setDefinitions
							.filter((definition) =>
								definitions.has(definition.definitionID)
							)
							.map((setDef) => {
								return {
									label: setDef.fullyQualifiedName,
									name: setDef.definitionID,
									expanded: false,
									items: setDef.valueDefinitions.map((val) => {
										return {
											label: val.name,
											name: `{{Contact.Attribute."${setDef.fullyQualifiedName}"."${val.name}"}}`,
											expanded: false,
											items: []
										};
									})
								};
							})
					};
				})
		};
	}
	/**
	 *
	 * @param data
	 */
	parseJourneyModel(data) {
		return {
			label: "Journey",
			name: "Journey",
			expanded: false,
			items: 
				data
					.filter(
						(source) =>
							(source.schema && source.schema.fields.length > 0) ||
							(source.deSchema && source.deSchema.fields.length > 0)
					)
					.map((source) => {
						//sometimes this is deSchema, sometimes schema
						if (
							source.deSchema &&
							source.deSchema.fields &&
							source.deSchema.fields.length > 0
						) {
							return {
								label: source.name,
								name: source.id,
								expanded: false,
								items: source.deSchema.fields.map((field) => {
									return {
										label: field.name,
										name: `{{${source.keyPrefix}"${field.name}"}}`,
										expanded: false,
										items: []
									};
								})
							};
						} else if (
							source.deSchema &&
							source.schema.fields &&
							source.schema.fields.length > 0
						) {
							return {
								label: source.name,
								name: source.id,
								expanded: false,
								items: source.schema.fields.map((field) => {
									return {
										label: field.name,
										name: `{{${source.keyPrefix}"${field.name}"}}`,
										expanded: false,
										items: []
									};
								})
							};
						}

						return {
							label: source.name,
							name: source.id,
							expanded: false,
							items: source.schema.fields.map((field) => {
								return {
									label: field.name,
									name: `{{${source.keyPrefix}"${field.name}"}}`,
									expanded: false,
									items: []
								};
							})
						};
					})
			
		};
	}
	/**
	 *
	 */
	get context() {
		return {
			label: "Context",
			name: "Context",
			expanded: false,
			items: [
				{
					label: "IsTest",
					name: "{{Context.IsTest}}",
					expanded: false,
					items: []
				},
				{
					label: "PublicationId",
					name: "{{Context.PublicationId}}",
					expanded: false,
					items: []
				},
				{
					label: "DefinitionId",
					name: "{{Context.DefinitionId}}",
					expanded: false,
					items: []
				},
				{
					label: "DefinitionInstanceId",
					name: "{{Context.DefinitionInstanceId}}",
					expanded: false,
					items: []
				},
				{
					label: "StartActivityKey",
					name: "{{Context.StartActivityKey}}",
					expanded: false,
					items: []
				},
				{
					label: "VersionNumber",
					name: "{{Context.VersionNumber}}",
					expanded: false,
					items: []
				},
				{
					label: "ContactKey",
					name: "{{Contact.Key}}",
					expanded: false,
					items: []
				},
				{
					label: "Default Email",
					name: "{{InteractionDefaults.Email}}",
					expanded: false,
					items: []
				}
			]
		};
	}

	/**
	 *
	 * @param e
	 */
	handleClick(e) {
		e.stopPropagation();
		//only parse fields

		if (
			e.detail.name &&
			e.detail.name.startsWith("{{") &&
			e.detail.name.endsWith("}}")
		) {
			this.dispatchEvent(
				new CustomEvent("selectitem", {
					bubbles: true,
					composed: true,
					detail: {
						name: e.detail.name
					}
				})
			);
		}
	}
}
