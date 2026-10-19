#ifndef __GLE_ACCESORIES_H__
#define __GLE_ACCESORIES_H__

	// General Accessories Elements
	void makeCD1(double L, double D, double tubeN, double W, double disc_t, double discN, double  H, double h, double alpha,
	             double handle_offset, double g, double stem_l, double stem_t, double stemN, double e);
	void makeCF1(double diam1, double length1, double length2, double heightWidth, int n);
	void makeCFC(double diam1, double diam2, double diam3, double length1, double length2, double length3, int n);
	void makeCH1(double a, double b, double diam1, double l1, double l2, double s1cp, double s2cp, int n);
	void makeCH2(double diam1, double l1, double s1cp, double s2cp, double a, double b, double e, int n);
	void makeCRD1(double diam1, double length1, double length2, double length3, double length4, double length5, double height, double width, int n);
	void makeCS1(double diam1, double diam2, double length1, double length2, int n);
	void makeRD1(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRF1(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRFC(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRH1(double a, double b, double l, double s1cp, double s2cp, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRH2(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRRD1(double a, double b, double A, double B, double l, double l2, double l3, double l4, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRS1(double a, double b, double l, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeIRIS(double l, double d1, double d2, int n);


	// New accesories - by PK - 09.06.02
	void makeRRS(double a, double b, double a0, double b0, double h0, double f0, double alfa);
	void makeRES(double a, double b, double e, double s, double d, double n, double h1, double h2, double h3,
	             double l1, double l2, double fls_down, double fls_right);

	// New accesories - by PK - 09.07.14
	void makeRH3(double a, double b, double l, double l1, double l2, double h, double a1, double s1cp,
	             double s2cp, double s3cp, double flange_1 = CONNECTOR_SIZE_N, double flange_2 = CONNECTOR_SIZE_N);
	void makeRD2(double a, double b, double l, double sa, double sb, double sl, double sd, double a_aux);
	void makeCCC(double d0, double a, double b, double h, double h1, double h2, double l, double f,
	             double c, double d, double a0, double b0, double n);
	void makeRCC(double d0, double a, double b, double h, double h1, double h2, double l, double f,
	             double c, double d, double a0, double b0, double n);

	// New accesories - by ZK - 09.08.11
	void makeRVAV(double a, double b, double l, double l1, double l2, double h, double h1, double h2, double h3);
	void makeSB(double d, double  d0, double  h0, double  d1, double  d2, double  d3, double  d4, double  d5, double  d6, double  d10, double  h, double  h1, double  h2, double  h3, double  h4, double  h5, int n);

	// New accesories - by LS - 09.10.02
	void makeRHU(double a, double b, double l, double sb, double sb1, double sa, double sa1,  double sl1, double sl2, double sl3, double s1cp, double s2cp, double s3cp, double s4cp, double fls);
	void makeCCAV(double a, double l, double sl1, double sd, double sd1);
	void makeCOWD(double d, double l, double sl1, double sl2, double sh1, double sh2);
	void makeRCAV(double a, double b, double l, double sa, double sb, double sl, double sl1, double sl2, double sd, double fls);
	void makeROWD(double a, double b, double l, double sd, double sa, double sb, double sl, double sl1, double sl2, double fls);
	void makeCVAV(double d, double l, double a, double b, double e, double l1, double sl1, double sl2, double sh1, double sh2, double sh3, double sh4);

	// New accesories by TK - 16.09.14 (and RDO1 for ALNOR DAMPER)
	void makeSUC(double d, double d1, double h, double z, double r, int n);
	void makeOKP(double a, double b, double d, double g, double l, double l2, int n);
	void makeRDO1(double a, double b, double l, double d1, double g, int n);
	void makeGLE(double d, double a, double b, double c, double d1, double l, int n);

#endif
