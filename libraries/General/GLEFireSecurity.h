#ifndef __GLE_FIRE_SECURITY_H__
#define __GLE_FIRE_SECURITY_H__

// class GLEFireSecurity
// {
//	public:

	// General Fire Security Elements
	void makeCFD1(double L, double D, double tubeN, double W, double disc_t, double discN, double H, double e, double f, double A, double B);
	void makeDRSD(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeDWSD(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeOWSD(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRFD1(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeSSD(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
    void makeTSD(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeFV1(double D1, double D2, double D3, double h, double n);

// };

#endif
