package org.wescheme.servlet;

import java.io.IOException;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.ServletException;

public class LetsencryptServlet extends HttpServlet {

    /**
	 *
	 */
	private static final long serialVersionUID = -3324616060342480492L;
	public static final Map<String, String> challenges = new HashMap<String, String>();

    static {
    	// TODO: need to change this to the real key/secret when we will really deployed
        challenges.put("R4fUbslsnpud3DENKy31YioazA0DoSmfz9IEebwo6kg",
                "R4fUbslsnpud3DENKy31YioazA0DoSmfz9IEebwo6kg.xnkLFayDWFaQYM5Din_gPCYjVLTiuh20aqr0XROuXac");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        if (!req.getRequestURI().startsWith("/.well-known/acme-challenge/")) {
            resp.sendError(404);
            return;
        }
        String id = req.getRequestURI().substring("/.well-known/acme-challenge/".length());
        if (!challenges.containsKey(id)) {
            resp.sendError(404);
            return;
        }
        resp.setContentType("text/plain");
        resp.getOutputStream().print(challenges.get(id));
    }
}
